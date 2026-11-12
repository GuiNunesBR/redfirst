import type { Rule } from '../rule.js';

export const focusedTest: Rule = {
  id: 'TL003',
  name: 'focused-test',
  severity: 'error',
  applies: 'both',
  description: 'A focused test or describe (.only, fit, fdescribe) silently skips the rest of the suite.',
  fix: 'Remove .only before committing.',
  check({ analysis, report }) {
    for (const block of analysis.blocks) {
      if (block.only) report(block.call, `Focused ${block.kind} "${block.title}" skips every other test.`, block.kind === 'test' ? block : undefined);
    }
  },
};
