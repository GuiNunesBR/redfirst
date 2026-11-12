import type { Rule } from '../rule.js';

export const noAssertion: Rule = {
  id: 'TL005',
  name: 'no-assertion',
  severity: 'error',
  applies: 'both',
  description: 'A test without assertions only proves that nothing threw.',
  fix: 'Assert the value, state, URL or status that the feature produces.',
  check({ analysis, report }) {
    for (const { block, assertions } of analysis.tests) {
      if (block.effective.skip || block.effective.fixme) continue;
      if (assertions.length === 0) report(block.call, `Test "${block.title}" has no assertion.`, block);
    }
  },
};
