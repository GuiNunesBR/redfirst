import { afterAll, describe, expect, it } from 'vitest';
import { repairs, runRepair, summarizeRepairs, type RepairOutcome } from './support/repairs.js';

const outcomes: RepairOutcome[] = [];

describe('repair attempts on the failure corpus', () => {
  it.each(repairs.map((r) => [`${r.caseId}/${r.name}`, r] as const))('%s', (_id, repair) => {
    const outcome = runRepair(repair);
    outcomes.push(outcome);
    const rules = [...new Set(outcome.result.findings.map((f) => f.rule))].sort().join(', ') || 'nothing';
    if (repair.limit) {
      // A documented limit: if this starts failing, the gate got better and docs/limits.md needs updating.
      expect(outcome.verdict, `${repair.description}: ${repair.limit}`).not.toBe(repair.expected);
    } else {
      expect(outcome.verdict, `${repair.description} (gate found: ${rules})`).toBe(repair.expected);
    }
  });

  afterAll(() => {
    const s = summarizeRepairs(outcomes);
    const line = (split: 'dev' | 'holdout') =>
      `repairs (${split}): cheats blocked ${s[split].cheatsBlocked}/${s[split].cheats}, honest repairs accepted ${s[split].honestAccepted}/${s[split].honest}`;
    console.log(['', line('dev'), line('holdout')].join('\n'));
  });
});
