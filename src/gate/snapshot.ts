import ts from 'typescript';
import { analyze } from '../core/analyze.js';
import type { Strength } from '../core/assertions.js';
import type { Framework } from '../core/types.js';

export interface AssertionSnapshot {
  matcher: string;
  subject: string;
  strength: Strength;
  expected: string | null;
  line: number;
  /** Inside an if/switch/ternary/catch/&&/|| branch of the test, so it may never run. */
  conditional: boolean;
}

function isConditional(node: ts.Node, stop: ts.Node): boolean {
  let child = node;
  for (let parent = node.parent; parent && parent !== stop; child = parent, parent = parent.parent) {
    if (ts.isIfStatement(parent) && child !== parent.expression) return true;
    if (ts.isConditionalExpression(parent) && child !== parent.condition) return true;
    if (ts.isCaseClause(parent) || ts.isDefaultClause(parent) || ts.isCatchClause(parent)) return true;
    if (
      ts.isBinaryExpression(parent) &&
      child === parent.right &&
      [ts.SyntaxKind.AmpersandAmpersandToken, ts.SyntaxKind.BarBarToken, ts.SyntaxKind.QuestionQuestionToken].includes(parent.operatorToken.kind)
    ) {
      return true;
    }
  }
  return false;
}

export interface TestSnapshot {
  file: string;
  title: string;
  line: number;
  assertions: AssertionSnapshot[];
  only: boolean;
  skip: boolean;
  fixme: boolean;
}

/** Tests of a file keyed by full title. Repeated titles get a `#2`, `#3` suffix so each stays distinct. */
export function snapshotFile(file: string, text: string, framework?: Framework): Map<string, TestSnapshot> {
  const analysis = analyze(file, text, framework);
  const tests = new Map<string, TestSnapshot>();
  for (const { block, assertions } of analysis.tests) {
    let key = block.fullTitle;
    for (let n = 2; tests.has(key); n++) key = `${block.fullTitle} #${n}`;
    tests.set(key, {
      file,
      title: key,
      line: block.line,
      assertions: assertions.map((a) => ({
        matcher: a.matcher,
        subject: a.subject,
        strength: a.strength,
        expected: a.expected,
        line: a.line,
        conditional: isConditional(a.node, block.fn),
      })),
      ...block.effective,
    });
  }
  return tests;
}

/** Longest common subsequence of two assertion lists by subject (what is checked), as index pairs. */
export function alignAssertions(base: AssertionSnapshot[], head: AssertionSnapshot[]): [number, number][] {
  const rows = base.length;
  const cols = head.length;
  const table = Array.from({ length: rows + 1 }, () => new Array<number>(cols + 1).fill(0));
  for (let i = rows - 1; i >= 0; i--) {
    for (let j = cols - 1; j >= 0; j--) {
      table[i]![j] = base[i]!.subject === head[j]!.subject ? table[i + 1]![j + 1]! + 1 : Math.max(table[i + 1]![j]!, table[i]![j + 1]!);
    }
  }
  const pairs: [number, number][] = [];
  let i = 0;
  let j = 0;
  while (i < rows && j < cols) {
    if (base[i]!.subject === head[j]!.subject) {
      pairs.push([i++, j++]);
    } else if (table[i + 1]![j]! >= table[i]![j + 1]!) {
      i++;
    } else {
      j++;
    }
  }
  return pairs;
}
