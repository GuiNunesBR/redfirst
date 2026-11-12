import ts from 'typescript';
import { chainRoot, walk } from '../../core/source.js';
import { testOf, type Rule } from '../rule.js';

const isCyChain = (node: ts.Expression | undefined) => !!node && ts.isCallExpression(node) && chainRoot(node) === 'cy';

export const cypressAsyncMisuse: Rule = {
  id: 'TL010',
  name: 'cypress-async-misuse',
  severity: 'error',
  applies: 'cypress',
  description: 'Cypress commands are queued, not promises: await and assigned results do not hold the value.',
  fix: 'Use .then() or aliases (.as / cy.get("@alias")).',
  check({ analysis, report }) {
    for (const { block } of analysis.tests) {
      const isAsync = block.fn.modifiers?.some((m) => m.kind === ts.SyntaxKind.AsyncKeyword);
      let usesCy = false;
      walk(block.fn.body, (node) => {
        if (ts.isIdentifier(node) && node.text === 'cy') usesCy = true;
      });
      if (isAsync && usesCy) report(block.call, `Test "${block.title}" is async but uses cy commands.`, block);
    }
    walk(analysis.sf, (node) => {
      if (ts.isAwaitExpression(node) && chainRoot(node.expression) === 'cy') {
        report(node, 'await on a cy command does not wait for it.', testOf(analysis, node));
      }
      if (ts.isVariableDeclaration(node) && isCyChain(node.initializer)) {
        report(node, `${node.name.getText(analysis.sf)} holds a chainer, not the element or value.`, testOf(analysis, node));
      }
    });
  },
};
