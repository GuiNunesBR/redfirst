import ts from 'typescript';
import { calledName, chainRoot, walk } from '../../core/source.js';
import { testOf, type Rule } from '../rule.js';

export const hardWait: Rule = {
  id: 'TL002',
  name: 'hard-wait',
  severity: 'error',
  applies: 'both',
  description: 'Fixed sleep: slow when the app is fast, flaky when it is slow.',
  fix: 'Wait for a condition (web-first assertion, waitForResponse, cy.intercept alias).',
  check({ analysis, report }) {
    walk(analysis.sf, (node) => {
      if (ts.isCallExpression(node)) {
        const name = calledName(node);
        if (name === 'waitForTimeout') {
          report(node, 'waitForTimeout() is a fixed sleep.', testOf(analysis, node));
        } else if (name === 'wait' && chainRoot(node.expression) === 'cy' && node.arguments[0] && ts.isNumericLiteral(node.arguments[0])) {
          report(node, `cy.wait(${node.arguments[0].text}) is a fixed sleep.`, testOf(analysis, node));
        } else if (name === 'sleep' && ts.isIdentifier(node.expression)) {
          report(node, 'sleep() is a fixed sleep.', testOf(analysis, node));
        }
      }
      if (ts.isNewExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'Promise') {
        let usesTimer = false;
        node.arguments?.forEach((arg) =>
          walk(arg, (inner) => {
            if (ts.isCallExpression(inner) && ts.isIdentifier(inner.expression) && inner.expression.text === 'setTimeout') usesTimer = true;
          }),
        );
        if (usesTimer) report(node, 'new Promise + setTimeout is a fixed sleep.', testOf(analysis, node));
      }
    });
  },
};
