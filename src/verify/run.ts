import path from 'node:path';
import { diagnoseProject, evidence, key, runsOf, testChanges, type Run } from '../diagnose/run.js';
import { gateProject, UsageError } from '../run.js';
import { verify, type Verification } from './verify.js';

export interface VerifyRequest {
  /** Git ref the failing run ran on. The repair is what changed from there to the working tree. */
  base?: string;
  /** JSON report of the repaired tests, ideally `--repeat-each=3 --trace=on`. */
  report?: string;
  /** JSON report of the failing run, with traces: the failure is diagnosed from it. */
  failing?: string;
  /** JSON report of the last passing run before the failure, with traces. */
  passing?: string;
  /** Git ref of that passing run: test code changed between it and `base` is evidence for the diagnosis. */
  green?: string;
  runs?: number;
  acceptAppChange?: boolean;
}

const name = (run: Run) => `${run.spec.file}:${run.spec.line} ${run.spec.title}`;

/**
 * Judges a repair of failing tests: was the test the thing to fix, did the fix weaken it, is it green and
 * stable, and does the green run still ask the app the same things and get the same answers.
 */
export function verifyProject(cwd: string, request: VerifyRequest): Verification[] {
  if (!request.base) throw new UsageError('verify needs --base <ref the failing run ran on>.');
  const gate = gateProject(cwd, { base: request.base, mode: 'heal' });
  const errors = gate.findings.filter((f) => f.severity === 'error').map((f) => `${f.file}:${f.line} ${f.rule} ${f.message}`);
  const testCodeChanged = testChanges(cwd, request.base).length > 0;

  const at = (file: string | undefined) => (file ? runsOf(path.resolve(cwd, file)) : []);
  const failed = at(request.failing).filter((r) => !['passed', 'skipped'].includes(r.result.status));
  const diagnoses = request.failing ? diagnoseProject(cwd, { report: request.failing, passing: request.passing, base: request.green, head: request.green ? request.base : undefined }) : [];
  const after = new Map<string, Run[]>();
  for (const run of at(request.report)) after.set(key(run), [...(after.get(key(run)) ?? []), run]);
  const passing = new Map(at(request.passing).filter((r) => r.result.status === 'passed').map((r) => [key(r), r]));

  // One verdict per failed test; without the failing report, one per repaired test in the report.
  const targets = failed.length ? failed : [...after.values()].map((runs) => runs[0]!);
  if (!targets.length) {
    return [verify({ test: 'the change', testCodeChanged, gate: { failed: gate.failed, errors }, runs: request.runs, acceptAppChange: request.acceptAppChange })];
  }
  return targets.map((target, i) => {
    const runs = after.get(key(target)) ?? [];
    const green = runs.find((r) => r.result.status === 'passed');
    const reference = passing.get(key(target));
    return verify({
      test: name(target),
      diagnosis: failed.length ? diagnoses[i] : undefined,
      testCodeChanged,
      gate: { failed: gate.failed, errors },
      after: runs.length ? { statuses: runs.map((r) => r.result.status), evidence: green ? evidence(green) : undefined } : undefined,
      passing: reference ? evidence(reference) : null,
      runs: request.runs,
      acceptAppChange: request.acceptAppChange,
    });
  });
}
