import ts from 'typescript';
import { calleeChain, isFunctionLike, position, stringValue } from './source.js';

export interface TestBlock {
  kind: 'test' | 'describe';
  title: string;
  /** Titles of the enclosing describes and the test, joined with ' › '. */
  fullTitle: string;
  call: ts.CallExpression;
  fn: ts.ArrowFunction | ts.FunctionExpression;
  line: number;
  column: number;
  only: boolean;
  skip: boolean;
  fixme: boolean;
  /** Same flags, including the ones inherited from enclosing describes. */
  effective: { only: boolean; skip: boolean; fixme: boolean };
}

/** A skip/fixme call without a callback, e.g. `test.skip(isMobile, 'reason')` inside a test or describe. */
export interface InlineSkip {
  call: ts.CallExpression;
  reason: string | null;
  line: number;
  column: number;
}

const TEST_ROOTS = ['test', 'it', 'specify', 'xit', 'fit', 'xspecify'];
const DESCRIBE_ROOTS = ['describe', 'context', 'xdescribe', 'fdescribe', 'xcontext', 'suite'];
const TEST_MODIFIERS = new Set(['only', 'skip', 'fixme', 'fail', 'each', 'concurrent']);
const DESCRIBE_MODIFIERS = new Set(['only', 'skip', 'fixme', 'serial', 'parallel', 'each']);

export const TITLE_SEPARATOR = ' › ';

/** `import { test as setup }` makes `setup(...)` a test too. */
export function testRoots(sf: ts.SourceFile): Set<string> {
  const roots = new Set(TEST_ROOTS);
  for (const statement of sf.statements) {
    if (!ts.isImportDeclaration(statement)) continue;
    const bindings = statement.importClause?.namedBindings;
    if (!bindings || !ts.isNamedImports(bindings)) continue;
    for (const element of bindings.elements) {
      const imported = element.propertyName?.text ?? element.name.text;
      if (imported === 'test' || imported === 'it') roots.add(element.name.text);
    }
  }
  return roots;
}

interface BlockShape {
  kind: 'test' | 'describe';
  only: boolean;
  skip: boolean;
  fixme: boolean;
}

function blockShape(chain: string[], roots: Set<string>): BlockShape | null {
  const [root, ...members] = chain;
  if (!root) return null;
  if (DESCRIBE_ROOTS.includes(root)) {
    if (!members.every((m) => DESCRIBE_MODIFIERS.has(m))) return null;
    return {
      kind: 'describe',
      only: members.includes('only') || root === 'fdescribe',
      skip: members.includes('skip') || root.startsWith('x'),
      fixme: members.includes('fixme'),
    };
  }
  if (!roots.has(root)) return null;
  const describeAt = members.indexOf('describe');
  if (describeAt >= 0) {
    const rest = members.slice(describeAt + 1);
    if (describeAt > 0 || !rest.every((m) => DESCRIBE_MODIFIERS.has(m))) return null;
    return { kind: 'describe', only: rest.includes('only'), skip: rest.includes('skip'), fixme: rest.includes('fixme') };
  }
  if (!members.every((m) => TEST_MODIFIERS.has(m))) return null;
  return {
    kind: 'test',
    only: members.includes('only') || root === 'fit',
    skip: members.includes('skip') || root === 'xit' || root === 'xspecify',
    fixme: members.includes('fixme'),
  };
}

function titleOf(arg: ts.Expression | undefined, sf: ts.SourceFile): string {
  if (!arg) return '';
  return stringValue(arg) ?? arg.getText(sf);
}

export function findBlocks(sf: ts.SourceFile): { blocks: TestBlock[]; inlineSkips: InlineSkip[] } {
  const roots = testRoots(sf);
  const blocks: TestBlock[] = [];
  const inlineSkips: InlineSkip[] = [];

  const visit = (node: ts.Node, parents: TestBlock[]): void => {
    if (ts.isCallExpression(node)) {
      const chain = calleeChain(node.expression);
      const shape = chain ? blockShape(chain, roots) : null;
      const fn = [...node.arguments].reverse().find(isFunctionLike);
      if (shape && fn) {
        const title = titleOf(node.arguments[0], sf);
        const parent = parents[parents.length - 1];
        const block: TestBlock = {
          ...shape,
          title,
          fullTitle: [...parents.map((p) => p.title), title].join(TITLE_SEPARATOR),
          call: node,
          fn,
          ...position(sf, node),
          effective: {
            only: shape.only || !!parent?.effective.only,
            skip: shape.skip || !!parent?.effective.skip,
            fixme: shape.fixme || !!parent?.effective.fixme,
          },
        };
        blocks.push(block);
        node.arguments.forEach((arg) => visit(arg, [...parents, block]));
        return;
      }
      if (chain && chain.length === 2 && roots.has(chain[0]!) && (chain[1] === 'skip' || chain[1] === 'fixme') && !fn) {
        const reason = node.arguments.map((a) => stringValue(a)).find((s) => s !== null) ?? null;
        inlineSkips.push({ call: node, reason, ...position(sf, node) });
      }
    }
    node.forEachChild((child) => visit(child, parents));
  };

  visit(sf, []);
  return { blocks, inlineSkips };
}
