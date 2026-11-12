import ts from 'typescript';
import { calleeChain, literalText, position, stringValue } from './source.js';

export type AssertionKind = 'expect' | 'should' | 'assert' | 'helper';
export type Strength = 'strong' | 'weak';

export interface Assertion {
  kind: AssertionKind;
  /** Outermost node of the assertion (the matcher call, or the chai property chain). */
  node: ts.Expression;
  /** The `expect(...)` call, for expect-style assertions. */
  expectCall?: ts.CallExpression;
  matcher: string;
  negated: boolean;
  strength: Strength;
  /** Normalized literal expected value; '' when the matcher takes no argument; null when not a literal. */
  expected: string | null;
  args: readonly ts.Expression[];
  /** `expect.poll(...)`, `.resolves` or `.rejects`. */
  async: boolean;
  line: number;
  column: number;
}

/** Presence-only matchers: they pass for any element or value that exists. */
const WEAK_MATCHERS = new Set(['toBeVisible', 'toBeAttached', 'toBeDefined', 'toBeTruthy', 'toBeFalsy']);
const WEAK_WHEN_NEGATED = new Set(['toBeNull', 'toBeUndefined']);
const WEAK_CHAINERS = new Set(['exist', 'be.visible', 'be.ok', 'ok']);

/** Opaque assertion helpers (`verifyCart()`, `expectToast()`); their body is not followed. */
const HELPER = /^(expect|assert|verify|check)[A-Z_]/;

function expectedOf(args: readonly ts.Expression[], sf: ts.SourceFile): string | null {
  if (args.length === 0) return '';
  const parts = args.map((a) => literalText(a, sf));
  return parts.every((p) => p !== null) ? parts.join(', ') : null;
}

function isExpectCall(call: ts.CallExpression): { poll: boolean } | null {
  const chain = calleeChain(call.expression);
  if (!chain || chain[0] !== 'expect') return null;
  if (chain.length === 1) return { poll: false };
  if (chain.length === 2 && (chain[1] === 'soft' || chain[1] === 'poll')) return { poll: chain[1] === 'poll' };
  return null;
}

/** From `expect(x)` up to the matcher: through property names, stopping at the first call (`.toBe(1)`). */
function climb(node: ts.Expression): ts.Expression {
  let top: ts.Expression = node;
  for (;;) {
    const parent = top.parent;
    if (ts.isPropertyAccessExpression(parent) && parent.expression === top) {
      top = parent;
    } else if (ts.isCallExpression(parent) && parent.expression === top) {
      return parent;
    } else {
      return top;
    }
  }
}

/** Property names from the `expect(...)` call up to `top`: `expect(x).not.to.have.text` -> ['not','to','have','text']. */
function namesBetween(top: ts.Expression, bottom: ts.Expression): string[] {
  const names: string[] = [];
  let node: ts.Expression = top;
  while (node !== bottom) {
    if (ts.isPropertyAccessExpression(node)) {
      names.unshift(node.name.text);
      node = node.expression;
    } else if (ts.isCallExpression(node)) {
      node = node.expression;
    } else {
      break;
    }
  }
  return names;
}

function strengthOf(kind: AssertionKind, matcher: string, negated: boolean): Strength {
  if (kind === 'helper' || kind === 'assert') return 'strong';
  if (kind === 'should') return WEAK_CHAINERS.has(matcher) ? 'weak' : 'strong';
  if (WEAK_MATCHERS.has(matcher) && !negated) return 'weak';
  if (WEAK_WHEN_NEGATED.has(matcher) && negated) return 'weak';
  if ((matcher === 'exist' || matcher === 'ok') && !negated) return 'weak';
  return 'strong';
}

export function findAssertions(root: ts.Node, sf: ts.SourceFile): Assertion[] {
  const found: Assertion[] = [];

  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node)) {
      const assertion = fromCall(node, sf);
      if (assertion) found.push(assertion);
    }
    node.forEachChild(visit);
  };
  visit(root);

  return found.sort((a, b) => a.node.getStart(sf) - b.node.getStart(sf));
}

function fromCall(call: ts.CallExpression, sf: ts.SourceFile): Assertion | null {
  const expect = isExpectCall(call);
  if (expect) {
    const top = climb(call);
    if (top === call) return null;
    const names = namesBetween(top, call);
    const matcher = names[names.length - 1] ?? '';
    const negated = names.includes('not');
    const args = ts.isCallExpression(top) ? top.arguments : [];
    return {
      kind: 'expect',
      node: top,
      expectCall: call,
      matcher,
      negated,
      strength: strengthOf('expect', matcher, negated),
      expected: expectedOf(args, sf),
      args,
      async: expect.poll || names.includes('resolves') || names.includes('rejects'),
      ...position(sf, top),
    };
  }

  const callee = call.expression;
  if (ts.isPropertyAccessExpression(callee) && (callee.name.text === 'should' || callee.name.text === 'and')) {
    const chainer = stringValue(call.arguments[0]);
    if (chainer === null) return null;
    const negated = chainer.startsWith('not.');
    const matcher = negated ? chainer.slice(4) : chainer;
    const args = call.arguments.slice(1);
    return {
      kind: 'should',
      node: call,
      matcher: chainer,
      negated,
      strength: negated ? 'strong' : strengthOf('should', matcher, false),
      expected: expectedOf(args, sf),
      args,
      async: false,
      ...position(sf, call),
    };
  }

  const chain = calleeChain(callee);
  if (chain && chain[0] === 'assert' && chain.length <= 2) {
    return {
      kind: 'assert',
      node: call,
      matcher: chain[1] ?? 'assert',
      negated: false,
      strength: 'strong',
      expected: expectedOf(call.arguments.slice(1), sf),
      args: call.arguments,
      async: false,
      ...position(sf, call),
    };
  }

  const name = ts.isIdentifier(callee) ? callee.text : ts.isPropertyAccessExpression(callee) ? callee.name.text : null;
  if (name && HELPER.test(name)) {
    return {
      kind: 'helper',
      node: call,
      matcher: name,
      negated: false,
      strength: 'strong',
      expected: null,
      args: call.arguments,
      async: false,
      ...position(sf, call),
    };
  }
  return null;
}
