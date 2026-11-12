import ts from 'typescript';
import type { Framework } from './types.js';

/**
 * Playwright when the file imports @playwright/test; Cypress when it uses `cy` or lives in a cypress path.
 * Files that import `test` from a local fixtures module are recognized by Playwright-only APIs
 * (`test.describe`, `test.use`, `test.step`) or by a test callback that destructures fixtures.
 */
export function detectFramework(sf: ts.SourceFile, file: string): Framework {
  for (const statement of sf.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) continue;
    const from = statement.moduleSpecifier.text;
    if (from === '@playwright/test' || from.startsWith('@playwright/') || from === 'playwright') return 'playwright';
    if (from === 'cypress' || from.startsWith('cypress/')) return 'cypress';
  }
  const text = sf.text;
  if (/(^|[\\/])cypress[\\/]/.test(file) || /\.cy\.[cm]?[jt]sx?$/.test(file) || /\bcy\.[A-Za-z]+\(/.test(text)) {
    return 'cypress';
  }
  if (/\btest\.(describe|use|step|beforeEach|afterEach|beforeAll|afterAll)\(/.test(text)) return 'playwright';
  if (/\b(test|it)\s*\([^)]*,\s*async\s*\(\s*\{/.test(text)) return 'playwright';
  return 'unknown';
}
