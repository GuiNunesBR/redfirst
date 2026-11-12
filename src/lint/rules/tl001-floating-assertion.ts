import ts from 'typescript';
import { testOf, type Rule } from '../rule.js';

/** Playwright matchers that retry and return a promise. */
export const WEB_FIRST_MATCHERS = new Set([
  'toBeAttached', 'toBeChecked', 'toBeDisabled', 'toBeEditable', 'toBeEmpty', 'toBeEnabled', 'toBeFocused',
  'toBeHidden', 'toBeInViewport', 'toBeVisible', 'toBeOK', 'toContainText', 'toContainClass',
  'toHaveAccessibleDescription', 'toHaveAccessibleErrorMessage', 'toHaveAccessibleName', 'toHaveAttribute',
  'toHaveClass', 'toHaveCount', 'toHaveCSS', 'toHaveId', 'toHaveJSProperty', 'toHaveRole', 'toHaveScreenshot',
  'toHaveText', 'toHaveTitle', 'toHaveURL', 'toHaveValue', 'toHaveValues', 'toMatchAriaSnapshot', 'toPass',
]);

export const floatingAssertion: Rule = {
  id: 'TL001',
  name: 'floating-assertion',
  severity: 'error',
  applies: 'playwright',
  description: 'Async web-first assertion that is not awaited: the test can end before it runs, so it never fails.',
  fix: 'await expect(...)…',
  check({ analysis, report }) {
    for (const a of analysis.assertions) {
      if (a.kind !== 'expect' || !(a.async || WEB_FIRST_MATCHERS.has(a.matcher))) continue;
      const parent = a.node.parent;
      if (ts.isExpressionStatement(parent) || ts.isVoidExpression(parent)) {
        report(a.node, `${a.matcher}() is not awaited, so its failure is lost.`, testOf(analysis, a.node));
      }
    }
  },
};
