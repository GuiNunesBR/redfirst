import { afterAll, describe, expect, it } from 'vitest';
import { cases, runCase, summarize, type Outcome } from './support/redteam.js';

const outcomes: Outcome[] = [];

describe('red-team corpus', () => {
  it.each(cases.map((c) => [c.id, c] as const))('%s', (_id, c) => {
    const outcome = runCase(c);
    outcomes.push(outcome);
    const { result, ids } = outcome;

    if (c.kind === 'adversarial' && c.expected) {
      expect([...ids], c.description).toEqual(expect.arrayContaining(c.expected));
    } else if (c.kind === 'adversarial') {
      // A documented limit: if this starts failing, the gate got better and docs/limits.md needs updating.
      expect(result.failed, `${c.description}: ${c.limit}`).toBe(false);
    } else if (c.knownFalsePositive) {
      expect(result.failed, c.knownFalsePositive).toBe(true);
    } else {
      expect(result.findings.filter((f) => f.severity === 'error'), c.description).toEqual([]);
    }
  });

  afterAll(() => {
    const s = summarize(outcomes);
    console.log(
      [
        '',
        `red team: flagged ${s.flagged}/${s.adversarial} adversarial changes, blocked ${s.blocked}/${s.adversarial}, ${s.limits} documented limit(s)`,
        `red team: false positives ${s.falsePositives}/${s.legitimate} legitimate changes (${s.documentedFalsePositives} documented)`,
        ...s.notBlocked.map((n) => `  not blocked: ${n}`),
      ].join('\n'),
    );
  });
});
