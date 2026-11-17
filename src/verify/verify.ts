import { compare, type Change, type Diagnosis } from '../diagnose/classify.js';
import type { Evidence } from '../diagnose/trace.js';

export type CheckStatus = 'pass' | 'fail' | 'unknown';

export interface Check {
  name: 'diagnosis' | 'gate' | 'green' | 'evidence';
  status: CheckStatus;
  detail: string[];
}

export interface VerifyInput {
  test: string;
  /** The diagnosis of the failure the repair answers, made before the repair. */
  diagnosis?: Diagnosis;
  /** Whether the repair changed test code (specs, page objects, helpers). */
  testCodeChanged: boolean;
  /** The gate in heal mode, from the failing state to the repaired one. */
  gate: { failed: boolean; errors: string[] };
  /** The repaired test's runs: one status per run, and the evidence of one that passed. */
  after?: { statuses: string[]; evidence?: Evidence };
  /** The test's last passing run before the failure. */
  passing?: Evidence | null;
  /** How many passing runs make the repair stable. */
  runs?: number;
  /** A human reviewed that the app changed on purpose: the app may answer differently than in the passing run. */
  acceptAppChange?: boolean;
}

export interface Verification {
  test: string;
  /** `verified`: every check passed. `rejected`: a check failed. `incomplete`: nothing failed, something could not be checked. */
  verdict: 'verified' | 'rejected' | 'incomplete';
  checks: Check[];
}

const expects = (e: Evidence) => e.actions.filter((a) => a.step.startsWith('Expect')).length;

/** Differences from the passing run that mean the app still misbehaves while the test is green. */
const APP_STILL_DIFFERENT: Change['kind'][] = ['status', 'response-shape', 'request-shape', 'slower', 'no-response', 'endpoint-replaced', 'call-missing'];

function diagnosisCheck(input: VerifyInput): Check {
  const d = input.diagnosis;
  if (!d) return { name: 'diagnosis', status: 'unknown', detail: ['No diagnosis of the failure: pass the failing report so the cause is known before the fix is judged.'] };
  const said = `The failure was diagnosed as ${d.category} (${d.confidence} confidence), action ${d.heal}.`;
  if (d.heal === 'update-test') return { name: 'diagnosis', status: 'pass', detail: [said] };
  if (!input.testCodeChanged) return { name: 'diagnosis', status: 'pass', detail: [said, 'The repair did not change test code.'] };
  if (input.acceptAppChange && d.heal === 'human') return { name: 'diagnosis', status: 'pass', detail: [said, 'A human accepted the change of the app.'] };
  return {
    name: 'diagnosis',
    status: 'fail',
    detail: [said, 'The repair changed test code. The test was right: report the failure, or ask, and leave the test as it was.', ...d.reasons],
  };
}

function gateCheck(input: VerifyInput): Check {
  return input.gate.failed
    ? { name: 'gate', status: 'fail', detail: input.gate.errors }
    : { name: 'gate', status: 'pass', detail: ['Nothing removed, weakened, skipped, slowed down or faked in the test code.'] };
}

function greenCheck(input: VerifyInput): Check {
  const need = input.runs ?? 3;
  const statuses = input.after?.statuses ?? [];
  if (!statuses.length) return { name: 'green', status: 'unknown', detail: [`No run of the repaired test: run it ${need} times (--repeat-each=${need}) with --reporter=json and pass the report.`] };
  const bad = statuses.filter((s) => s !== 'passed');
  if (bad.length) return { name: 'green', status: 'fail', detail: [`${bad.length} of ${statuses.length} runs of the repaired test did not pass (${[...new Set(bad)].join(', ')}).`] };
  if (statuses.length < need) return { name: 'green', status: 'unknown', detail: [`Passed ${statuses.length} time(s); ${need} are needed to call it stable (--repeat-each=${need}).`] };
  return { name: 'green', status: 'pass', detail: [`Passed ${statuses.length} of ${statuses.length} runs.`] };
}

function evidenceCheck(input: VerifyInput): Check {
  const after = input.after?.evidence;
  if (!after) return { name: 'evidence', status: 'unknown', detail: ['No trace of the repaired test: run it with --trace=on to check what it sent, got and asserted.'] };
  const problems: string[] = [];
  for (const call of after.calls.filter((c) => c.answeredBy)) problems.push(`${call.from} ${call.method} ${call.endpoint} was answered by ${call.answeredBy}.`);
  if (!input.passing) {
    return problems.length
      ? { name: 'evidence', status: 'fail', detail: problems }
      : { name: 'evidence', status: 'unknown', detail: ['No passing run from before the failure to compare the repaired run with.'] };
  }
  const before = expects(input.passing);
  const now = expects(after);
  if (now < before) problems.push(`Fewer assertions ran in the repaired test: ${now}, against ${before} when it last passed.`);
  if (!input.acceptAppChange) {
    // Which calls the test itself makes is the test's business; how the app answers is not.
    const testsOwnCalls = (c: Change) => (c.kind === 'endpoint-replaced' || c.kind === 'call-missing') && /^(The test|test) /.test(c.detail);
    const still = compare(input.passing, after).filter((c) => APP_STILL_DIFFERENT.includes(c.kind) && !testsOwnCalls(c));
    if (still.length) problems.push('The app still behaves differently than when the test last passed, and the test is green anyway:', ...still.map((c) => `  ${c.detail}`));
  }
  return problems.length
    ? { name: 'evidence', status: 'fail', detail: problems }
    : { name: 'evidence', status: 'pass', detail: [`Same calls and answers as the last passing run, no faked answer, assertions run: ${now} (${before} then).`] };
}

export function verify(input: VerifyInput): Verification {
  const checks = [diagnosisCheck(input), gateCheck(input), greenCheck(input), evidenceCheck(input)];
  const verdict = checks.some((c) => c.status === 'fail') ? 'rejected' : checks.some((c) => c.status === 'unknown') ? 'incomplete' : 'verified';
  return { test: input.test, verdict, checks };
}

export function formatVerification(v: Verification): string {
  const mark = { pass: 'ok     ', fail: 'FAILED ', unknown: 'unknown' } as const;
  return [
    v.test,
    ...v.checks.flatMap((c) => [`  ${mark[c.status]} ${c.name}: ${c.detail[0] ?? ''}`, ...c.detail.slice(1).map((d) => `            ${d}`)]),
    `  verdict: ${v.verdict.toUpperCase()}`,
  ].join('\n');
}
