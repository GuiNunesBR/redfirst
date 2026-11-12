import ts from 'typescript';

export function parseSource(file: string, text: string): ts.SourceFile {
  return ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, scriptKind(file));
}

function scriptKind(file: string): ts.ScriptKind {
  if (/\.[cm]?tsx$/.test(file)) return ts.ScriptKind.TSX;
  if (/\.[cm]?ts$/.test(file)) return ts.ScriptKind.TS;
  if (/\.jsx$/.test(file)) return ts.ScriptKind.JSX;
  return ts.ScriptKind.JS;
}

export function position(sf: ts.SourceFile, node: ts.Node): { line: number; column: number } {
  const { line, character } = sf.getLineAndCharacterOfPosition(node.getStart(sf));
  return { line: line + 1, column: character + 1 };
}

/** Names along a callee: `test.describe.only` -> ['test', 'describe', 'only']. Calls in the middle are skipped (`test.each([])`). */
export function calleeChain(expr: ts.Expression): string[] | null {
  if (ts.isIdentifier(expr)) return [expr.text];
  if (ts.isPropertyAccessExpression(expr)) {
    const left = calleeChain(expr.expression);
    return left ? [...left, expr.name.text] : null;
  }
  if (ts.isCallExpression(expr)) return calleeChain(expr.expression);
  if (ts.isParenthesizedExpression(expr) || ts.isNonNullExpression(expr)) return calleeChain(expr.expression);
  return null;
}

/** Leftmost identifier of a member/call chain: `page.locator('a').first()` -> 'page'. */
export function chainRoot(expr: ts.Expression): string | null {
  let node: ts.Expression = expr;
  for (;;) {
    if (ts.isIdentifier(node)) return node.text;
    if (node.kind === ts.SyntaxKind.ThisKeyword) return 'this';
    if (
      ts.isPropertyAccessExpression(node) ||
      ts.isElementAccessExpression(node) ||
      ts.isCallExpression(node) ||
      ts.isParenthesizedExpression(node) ||
      ts.isNonNullExpression(node) ||
      ts.isAwaitExpression(node)
    ) {
      node = node.expression;
      continue;
    }
    return null;
  }
}

/** Method name of a call (`a.b.c()` -> 'c', `c()` -> 'c'). */
export function calledName(call: ts.CallExpression): string | null {
  const callee = call.expression;
  if (ts.isIdentifier(callee)) return callee.text;
  if (ts.isPropertyAccessExpression(callee)) return callee.name.text;
  return null;
}

export function isFunctionLike(node: ts.Node | undefined): node is ts.ArrowFunction | ts.FunctionExpression {
  return !!node && (ts.isArrowFunction(node) || ts.isFunctionExpression(node));
}

export function stringValue(node: ts.Node | undefined): string | null {
  if (!node) return null;
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  return null;
}

export function walk(node: ts.Node, visit: (node: ts.Node) => void): void {
  visit(node);
  node.forEachChild((child) => walk(child, visit));
}

/**
 * Normalized text of a literal expected value, or null when the value is not a literal.
 * Used to tell when an expected value changed between two versions of a test.
 */
export function literalText(node: ts.Expression, sf: ts.SourceFile): string | null {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return JSON.stringify(node.text);
  if (ts.isNumericLiteral(node)) return String(Number(node.text.replace(/_/g, '')));
  if (ts.isRegularExpressionLiteral(node)) return node.text;
  if (
    node.kind === ts.SyntaxKind.TrueKeyword ||
    node.kind === ts.SyntaxKind.FalseKeyword ||
    node.kind === ts.SyntaxKind.NullKeyword
  ) {
    return node.getText(sf);
  }
  if (ts.isIdentifier(node) && node.text === 'undefined') return 'undefined';
  if (ts.isPrefixUnaryExpression(node) && ts.isNumericLiteral(node.operand)) {
    return node.getText(sf).replace(/\s+/g, '');
  }
  if (ts.isArrayLiteralExpression(node)) {
    const items = node.elements.map((e) => literalText(e, sf));
    return items.every((i) => i !== null) ? `[${items.join(',')}]` : null;
  }
  if (ts.isObjectLiteralExpression(node)) {
    const parts: string[] = [];
    for (const prop of node.properties) {
      if (!ts.isPropertyAssignment(prop)) return null;
      const value = literalText(prop.initializer, sf);
      if (value === null) return null;
      parts.push(`${prop.name.getText(sf)}:${value}`);
    }
    return `{${parts.join(',')}}`;
  }
  return null;
}
