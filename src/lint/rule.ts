import type ts from 'typescript';
import type { Analysis } from '../core/analyze.js';
import type { TestBlock } from '../core/tests.js';
import type { Severity } from '../core/types.js';

export interface RuleContext {
  analysis: Analysis;
  report(node: ts.Node, message: string, test?: TestBlock): void;
}

export interface Rule {
  id: string;
  name: string;
  severity: Severity;
  applies: 'both' | 'playwright' | 'cypress';
  /** One line: what the rule catches. */
  description: string;
  fix: string;
  check(ctx: RuleContext): void;
}

/** The test whose callback contains `node`, if any. */
export function testOf(analysis: Analysis, node: ts.Node): TestBlock | undefined {
  const start = node.getStart(analysis.sf);
  return analysis.tests
    .map((t) => t.block)
    .filter((b) => b.fn.getStart(analysis.sf) <= start && start < b.fn.getEnd())
    .pop();
}
