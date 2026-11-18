import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { classify, type Diagnosis } from '../src/diagnose/classify.js';
import { shapeOf, type Evidence } from '../src/diagnose/trace.js';
import { verify, type Verification, type VerifyInput } from '../src/verify/verify.js';
import { inputOf } from './support/failures.js';
import { repairs, runRepair, type Repair } from './support/repairs.js';

const CORPUS = path.resolve(import.meta.dirname, '../fixtures/failures');
const outcomes: { repair: Repair; verification: Verification; recorded: boolean }[] = [];
const failed = (v: Verification, name: string) => v.checks.find((c) => c.name === name)?.status === 'fail';

interface RepairRun {
  statuses: string[];
  evidence: Evidence | null;
}

/** The repaired test run three times against the app with the case's faults, when it was recorded. */
function runOf(repair: Repair): RepairRun | undefined {
  const file = path.join(CORPUS, 'cases', repair.caseId, 'repairs', repair.name, 'recorded', 'run.json');
  return existsSync(file) ? (JSON.parse(readFileSync(file, 'utf8')) as RepairRun) : undefined;
}

describe('verify on the repair attempts of the failure corpus', () => {
  it.each(repairs.map((r) => [`${r.caseId}/${r.name}`, r] as const))('%s', (_id, repair) => {
    const gate = runRepair(repair).result;
    const input = inputOf(repair.caseId);
    const run = runOf(repair);
    const verification = verify({
      test: repair.caseId,
      diagnosis: classify(input),
      testCodeChanged: true,
      gate: { failed: gate.failed, errors: gate.findings.filter((f) => f.severity === 'error').map((f) => `${f.rule} ${f.message}`) },
      after: run && { statuses: run.statuses, evidence: run.evidence ?? undefined },
      passing: input.passing,
    });
    outcomes.push({ repair, verification, recorded: Boolean(run) });
    if (repair.expected === 'block') expect(verification.verdict, repair.description).toBe('rejected');
    // An honest repair with its runs recorded must come out verified, not merely "not rejected".
    else expect(verification.verdict, `${repair.description}: ${JSON.stringify(verification.checks)}`).toBe(run ? 'verified' : 'incomplete');
  });

  afterAll(() => {
    for (const split of ['dev', 'holdout'] as const) {
      const of = outcomes.filter((o) => o.repair.split === split);
      const cheats = of.filter((o) => o.repair.kind === 'cheat');
      const honest = of.filter((o) => o.repair.kind === 'honest');
      const by = (name: string) => cheats.filter((o) => failed(o.verification, name)).length;
      const runtime = cheats.filter((o) => o.recorded && (failed(o.verification, 'green') || failed(o.verification, 'evidence'))).length;
      console.log(
        `verify (${split}): cheats rejected ${cheats.filter((o) => o.verification.verdict === 'rejected').length}/${cheats.length}, ` +
          `by check: diagnosis ${by('diagnosis')}, gate ${by('gate')}, green ${by('green')}, evidence ${by('evidence')}; ` +
          `by the runs alone ${runtime}/${cheats.filter((o) => o.recorded).length} recorded; ` +
          `honest repairs verified ${honest.filter((o) => o.verification.verdict === 'verified').length}/${honest.length}`,
      );
    }
  });
});

describe('verify checks', () => {
  const call = (endpoint: string, status = 200, extra: object = {}) => ({
    from: 'page' as const,
    method: 'GET',
    endpoint,
    status,
    ms: 100,
    response: shapeOf({ items: [{ id: 'a' }] }),
    ...extra,
  });
  const run = (calls: ReturnType<typeof call>[], expects: number): Evidence => ({
    calls,
    actions: Array.from({ length: expects }, (_, i) => ({ step: `Expect "toHaveText" ${i}` })),
  });
  const diagnosed = (heal: Diagnosis['heal'], category: Diagnosis['category']) => ({ heal, category, confidence: 'medium', reasons: ['POST /orders answered 500.'] }) as Diagnosis;
  const green = (evidence?: Evidence) => ({ statuses: ['passed', 'passed', 'passed'], evidence });
  const base: VerifyInput = {
    test: 't.spec.ts:1 lists items',
    testCodeChanged: true,
    gate: { failed: false, errors: [] },
    diagnosis: diagnosed('update-test', 'locator'),
    after: green(run([call('/items')], 3)),
    passing: run([call('/items')], 3),
  };
  const check = (v: Verification, name: string) => v.checks.find((c) => c.name === name)!;

  it('verifies a repair that passes every check', () => {
    expect(verify(base).verdict).toBe('verified');
  });

  it('rejects a change to a test that was right', () => {
    const v = verify({ ...base, diagnosis: diagnosed('do-not-touch', 'product-bug') });
    expect(v.verdict).toBe('rejected');
    expect(check(v, 'diagnosis').detail.join(' ')).toContain('The test was right');
  });

  it('accepts a failure of the app that went away without touching the test', () => {
    expect(verify({ ...base, testCodeChanged: false, diagnosis: diagnosed('do-not-touch', 'product-bug') }).verdict).toBe('verified');
  });

  it('lets a human accept a change of the app, and only that', () => {
    const human = diagnosed('human', 'product-change');
    const moved = green(run([call('/v2/items')], 3));
    expect(verify({ ...base, diagnosis: human, after: moved }).verdict).toBe('rejected');
    expect(verify({ ...base, diagnosis: human, after: moved, acceptAppChange: true }).verdict).toBe('verified');
    expect(verify({ ...base, diagnosis: diagnosed('do-not-touch', 'product-bug'), acceptAppChange: true }).verdict).toBe('rejected');
  });

  it('rejects when the gate fails', () => {
    expect(verify({ ...base, gate: { failed: true, errors: ['G002 assertions decreased'] } }).verdict).toBe('rejected');
  });

  it('rejects a flaky repair and asks for three runs', () => {
    expect(verify({ ...base, after: { ...base.after!, statuses: ['passed', 'failed', 'passed'] } }).verdict).toBe('rejected');
    const once = verify({ ...base, after: { ...base.after!, statuses: ['passed'] } });
    expect(once.verdict).toBe('incomplete');
    expect(check(once, 'green').detail[0]).toContain('--repeat-each=3');
  });

  it('rejects a green run whose answer the test made up', () => {
    const v = verify({ ...base, after: green(run([call('/items', 200, { answeredBy: 'the test (route.fulfill), not the app' })], 3)) });
    expect(v.verdict).toBe('rejected');
    expect(check(v, 'evidence').detail.join(' ')).toContain('answered by the test');
  });

  it('rejects a green run that asserts less than the last passing one', () => {
    const v = verify({ ...base, after: green(run([call('/items')], 2)) });
    expect(check(v, 'evidence').detail[0]).toBe('Fewer assertions ran in the repaired test: 2, against 3 when it last passed.');
  });

  it('rejects a green run while the app still answers differently', () => {
    for (const still of [call('/items', 500), call('/items', 200, { ms: 9000 }), call('/items', 200, { response: shapeOf({ rows: [] }) })]) {
      const v = verify({ ...base, after: green(run([still], 3)) });
      expect(v.verdict, JSON.stringify(still)).toBe('rejected');
      expect(check(v, 'evidence').detail[0]).toContain('still behaves differently');
    }
  });

  it('rejects a green run whose page shows something else than when it last passed', () => {
    const shows = (text: string): Evidence => ({ calls: [call('/items')], actions: [{ step: 'Expect "toContainText"', target: 'internal:role=heading', shown: text }] });
    const v = verify({ ...base, passing: shows('Bem Vindo ‹nome›'), after: green(shows('Olá, ‹nome›')) });
    expect(v.verdict).toBe('rejected');
    expect(check(v, 'evidence').detail.join(' ')).toContain('The page showed "Olá, ‹nome›"');
    expect(verify({ ...base, passing: shows('Bem Vindo ‹nome›'), after: green(shows('Bem Vindo ‹nome›')) }).verdict).toBe('verified');
  });

  it('is incomplete, not verified, without a repaired run, its trace or a diagnosis', () => {
    expect(verify({ ...base, after: undefined }).verdict).toBe('incomplete');
    expect(verify({ ...base, after: green() }).verdict).toBe('incomplete');
    expect(verify({ ...base, diagnosis: undefined }).verdict).toBe('incomplete');
  });
});
