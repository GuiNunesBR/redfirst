import ts from 'typescript';
import { findAssertions } from '../../core/assertions.js';
import { walk } from '../../core/source.js';
import type { Rule } from '../rule.js';

export const conditionalTestLogic: Rule = {
  id: 'TL008',
  name: 'conditional-test-logic',
  severity: 'warn',
  applies: 'both',
  description: 'An assertion inside if/switch/ternary/catch only runs on some paths, so the test can pass without checking it.',
  fix: 'Make the test deterministic; split it per case or move the branching into setup.',
  check({ analysis, report }) {
    const hasAssertion = (node: ts.Node | undefined) => !!node && findAssertions(node, analysis.sf).length > 0;
    for (const { block } of analysis.tests) {
      walk(block.fn.body, (node) => {
        let branches: (ts.Node | undefined)[] = [];
        let what = '';
        if (ts.isIfStatement(node)) {
          branches = [node.thenStatement, node.elseStatement];
          what = 'if';
        } else if (ts.isSwitchStatement(node)) {
          branches = [node.caseBlock];
          what = 'switch';
        } else if (ts.isConditionalExpression(node)) {
          branches = [node.whenTrue, node.whenFalse];
          what = 'ternary';
        } else if (ts.isTryStatement(node)) {
          branches = [node.catchClause];
          what = 'catch';
        }
        if (branches.some(hasAssertion)) report(node, `Assertion inside a ${what} branch only runs on some paths.`, block);
      });
    }
  },
};
