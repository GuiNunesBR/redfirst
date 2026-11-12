import ts from 'typescript';
import { calledName, chainRoot, isFunctionLike, walk } from '../../core/source.js';
import { testOf, type Rule } from '../rule.js';

/**
 * A sleep resolves when the timer fires: `setTimeout(resolve, n)` or `setTimeout(() => resolve(), n)`.
 * A timer that only rejects is a timeout guard, not a wait.
 */
function resolvesOnTimer(executor: ts.Expression | undefined): boolean {
  if (!isFunctionLike(executor)) return false;
  const resolve = executor.parameters[0]?.name;
  if (!resolve || !ts.isIdentifier(resolve)) return false;
  let sleeps = false;
  walk(executor.body, (node) => {
    if (!ts.isCallExpression(node) || !ts.isIdentifier(node.expression) || node.expression.text !== 'setTimeout') return;
    const callback = node.arguments[0];
    if (callback && ts.isIdentifier(callback) && callback.text === resolve.text) sleeps = true;
    if (isFunctionLike(callback)) {
      walk(callback.body, (inner) => {
        if (ts.isCallExpression(inner) && ts.isIdentifier(inner.expression) && inner.expression.text === resolve.text) sleeps = true;
      });
    }
  });
  return sleeps;
}

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
        if (resolvesOnTimer(node.arguments?.[0])) report(node, 'new Promise + setTimeout is a fixed sleep.', testOf(analysis, node));
      }
    });
  },
};
