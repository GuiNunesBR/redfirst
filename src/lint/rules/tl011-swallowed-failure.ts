import ts from 'typescript';
import { findAssertions } from '../../core/assertions.js';
import { chainRoot, isFunctionLike, walk } from '../../core/source.js';
import { testOf, type Rule } from '../rule.js';

const SWALLOWED_VALUES = new Set(['null', 'undefined', 'void 0', 'false', '{}']);

function swallows(handler: ts.Expression | undefined, sf: ts.SourceFile): boolean {
  if (!isFunctionLike(handler)) return false;
  const body = handler.body;
  if (ts.isBlock(body)) return body.statements.length === 0;
  return SWALLOWED_VALUES.has(body.getText(sf).replace(/^\(|\)$/g, ''));
}

function rethrows(clause: ts.CatchClause): boolean {
  let found = false;
  walk(clause.block, (node) => {
    if (ts.isThrowStatement(node)) found = true;
  });
  return found;
}

export const swallowedFailure: Rule = {
  id: 'TL011',
  name: 'swallowed-failure',
  severity: 'error',
  applies: 'both',
  description: 'A failure that is caught and dropped turns a red test green.',
  fix: 'Let the failure surface; remove the catch or rethrow.',
  check({ analysis, report }) {
    walk(analysis.sf, (node) => {
      if (
        ts.isCallExpression(node) &&
        ts.isPropertyAccessExpression(node.expression) &&
        node.expression.name.text === 'catch' &&
        ['page', 'expect', 'cy'].includes(chainRoot(node.expression.expression) ?? '') &&
        swallows(node.arguments[0], analysis.sf)
      ) {
        report(node, '.catch() drops the failure.', testOf(analysis, node));
      }
      if (
        ts.isTryStatement(node) &&
        node.catchClause &&
        findAssertions(node.tryBlock, analysis.sf).length > 0 &&
        !rethrows(node.catchClause)
      ) {
        report(node, 'try/catch around an assertion drops its failure.', testOf(analysis, node));
      }
    });
  },
};
