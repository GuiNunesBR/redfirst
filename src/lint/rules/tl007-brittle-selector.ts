import ts from 'typescript';
import { calledName, stringValue, walk } from '../../core/source.js';
import { testOf, type Rule } from '../rule.js';

const STABLE_LOCATORS = new Set(['getByRole', 'getByTestId', 'getByLabel', 'getByPlaceholder', 'getByAltText', 'getByTitle']);
const STABLE_ATTRIBUTE = /data-(testid|test-id|test|cy|qa)\b/;
const SELECTOR_TAKERS = new Set(['locator', 'get', 'find', '$', '$$', 'querySelector', 'querySelectorAll', 'waitForSelector', 'frameLocator']);

/** `a.locator(x).filter(y).first()` -> the calls before `.first()`. */
function chainCalls(call: ts.CallExpression): ts.CallExpression[] {
  const calls: ts.CallExpression[] = [];
  let node: ts.Expression = call.expression;
  for (;;) {
    if (ts.isPropertyAccessExpression(node)) node = node.expression;
    else if (ts.isCallExpression(node)) {
      calls.push(node);
      node = node.expression;
    } else return calls;
  }
}

function anchoredOnStableHandle(call: ts.CallExpression): boolean {
  return chainCalls(call).some((c) => {
    const name = calledName(c);
    if (name && STABLE_LOCATORS.has(name)) return true;
    return c.arguments.some((arg) => STABLE_ATTRIBUTE.test(stringValue(arg) ?? ''));
  });
}

function combinators(selector: string): number {
  const flat = selector
    .replace(/\[[^\]]*\]/g, '[]')
    .replace(/\([^)]*\)/g, '()')
    .trim()
    .replace(/\s*([>+~])\s*/g, '$1');
  return (flat.match(/[>+~ ]/g) ?? []).length;
}

export function brittleReason(selector: string): string | null {
  if (/^(xpath=|\/\/|\(\/\/)/.test(selector)) return 'XPath selector';
  if (/:nth-(child|of-type)\(/.test(selector)) return ':nth-child selector';
  if (combinators(selector) >= 3) return 'long CSS chain';
  return null;
}

export const brittleSelector: Rule = {
  id: 'TL007',
  name: 'brittle-selector',
  severity: 'warn',
  applies: 'both',
  description: 'Position-based or structure-based selectors break when the layout changes, not when the feature does.',
  fix: 'Prefer role, label or test-id locators.',
  check({ analysis, report }) {
    walk(analysis.sf, (node) => {
      if (!ts.isCallExpression(node)) return;
      const name = calledName(node);
      if ((name === 'nth' || name === 'first' || name === 'last') && ts.isPropertyAccessExpression(node.expression)) {
        if (!anchoredOnStableHandle(node)) report(node, `.${name}() picks an element by position.`, testOf(analysis, node));
        return;
      }
      if (name && SELECTOR_TAKERS.has(name)) {
        const selector = stringValue(node.arguments[0]);
        const reason = selector === null ? null : brittleReason(selector);
        if (reason) report(node.arguments[0]!, `${reason}: '${selector}'.`, testOf(analysis, node));
      }
    });
  },
};
