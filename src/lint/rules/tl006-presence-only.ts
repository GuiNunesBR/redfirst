import type { Rule } from '../rule.js';

export const presenceOnly: Rule = {
  id: 'TL006',
  name: 'presence-only',
  severity: 'warn',
  applies: 'both',
  description: 'Every assertion only checks that something exists or is visible; nothing checks a value.',
  fix: 'Assert the value or state the feature produces (text, URL, count, status).',
  check({ analysis, report }) {
    for (const { block, assertions } of analysis.tests) {
      if (assertions.length > 0 && assertions.every((a) => a.strength === 'weak')) {
        const matchers = [...new Set(assertions.map((a) => a.matcher))].join(', ');
        report(block.call, `Test "${block.title}" only checks presence (${matchers}).`, block);
      }
    }
  },
};
