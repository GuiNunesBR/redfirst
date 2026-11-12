import ts from 'typescript';
import { literalText } from '../../core/source.js';
import { testOf, type Rule } from '../rule.js';

export const tautologicalAssertion: Rule = {
  id: 'TL012',
  name: 'tautological-assertion',
  severity: 'error',
  applies: 'both',
  description: 'An assertion on constants (or on a value against itself) cannot fail.',
  fix: 'Assert something the product produced.',
  check({ analysis, report }) {
    const { sf } = analysis;
    for (const a of analysis.assertions) {
      const subject = a.kind === 'expect' ? a.expectCall?.arguments[0] : a.kind === 'assert' ? a.args[0] : undefined;
      if (!subject) continue;
      const others = a.kind === 'assert' ? a.args.slice(1) : a.args;
      const constant = literalText(subject, sf) !== null && others.every((arg) => literalText(arg, sf) !== null);
      const selfCompare =
        (ts.isIdentifier(subject) || ts.isPropertyAccessExpression(subject)) &&
        others.length === 1 &&
        others[0]!.getText(sf) === subject.getText(sf);
      if (constant || selfCompare) {
        report(a.node, `${a.node.getText(sf).replace(/\s+/g, ' ')} cannot fail.`, testOf(analysis, a.node));
      }
    }
  },
};
