import ts from 'typescript';
import { calledName, walk } from '../../core/source.js';
import { testOf, type Rule } from '../rule.js';

const LEGACY = new Set(['$', '$$', '$eval', '$$eval', 'waitForSelector']);

export const legacySelectorApi: Rule = {
  id: 'TL009',
  name: 'legacy-selector-api',
  severity: 'warn',
  applies: 'playwright',
  description: 'ElementHandle APIs do not auto-wait or retry like locators do.',
  fix: 'Use locators and web-first assertions.',
  check({ analysis, report }) {
    walk(analysis.sf, (node) => {
      if (!ts.isCallExpression(node) || !ts.isPropertyAccessExpression(node.expression)) return;
      const name = calledName(node);
      if (name && LEGACY.has(name)) report(node, `${name}() is a legacy ElementHandle API.`, testOf(analysis, node));
    });
  },
};
