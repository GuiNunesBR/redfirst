import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { globToRegExp, runGate, type GateOptions } from '../src/gate/gate.js';
import { gitChangedFiles, gitRefSource, worktreeSource, type FileSource } from '../src/gate/sources.js';

function memory(files: Record<string, string>): FileSource {
  return { label: 'memory', files: () => Object.keys(files), read: (f) => files[f] };
}

function gate(base: Record<string, string>, head: Record<string, string>, options: Partial<GateOptions> = {}) {
  const result = runGate({ base: memory(base), head: memory(head), ...options });
  return { ...result, rules: result.findings.map((f) => `${f.rule}:${f.severity}`) };
}

const spec = (body: string) => `import { test, expect } from '@playwright/test';

test('creates the order', async ({ request }) => {
  const response = await request.post('/api/orders');
${body}
});
`;

const FILE = 'tests/orders.spec.ts';
const STRONG = `  expect(response.status()).toBe(201);\n  expect(await response.json()).toMatchObject({ id: 1 });`;

describe('G001 test-removed', () => {
  it('flags a removed test', () => {
    expect(gate({ [FILE]: spec(STRONG) }, { [FILE]: "import { test } from '@playwright/test';\n" }).rules).toEqual(['G001:error']);
  });
  it('accepts it with --allow-removal', () => {
    expect(gate({ [FILE]: spec(STRONG) }, { [FILE]: "import { test } from '@playwright/test';\n" }, { allowRemoval: true }).rules).toEqual([]);
  });
});

describe('G002 assertions-decreased', () => {
  it('flags a removed assertion', () => {
    expect(gate({ [FILE]: spec(STRONG) }, { [FILE]: spec('  expect(response.status()).toBe(201);') }).rules).toEqual(['G002:error']);
  });
  it('flags an assertion moved behind a condition', () => {
    const head = spec(`  expect(response.status()).toBe(201);\n  if (process.env.FULL) {\n    expect(await response.json()).toMatchObject({ id: 1 });\n  }`);
    expect(gate({ [FILE]: spec(STRONG) }, { [FILE]: head }).rules).toContain('G002:error');
  });
  it('accepts an added assertion', () => {
    const head = spec(`${STRONG}\n  expect(response.headers()['content-type']).toContain('json');`);
    expect(gate({ [FILE]: spec(STRONG) }, { [FILE]: head }).rules).toEqual([]);
  });
});

describe('G003 assertion-weakened', () => {
  const page = (assertion: string) => `import { test, expect } from '@playwright/test';\n\ntest('shows the total', async ({ page }) => {\n  ${assertion}\n});\n`;
  it('flags a value check turned into a presence check', () => {
    const result = gate({ [FILE]: page("await expect(page.getByTestId('total')).toHaveText('R$ 10');") }, { [FILE]: page("await expect(page.getByTestId('total')).toBeVisible();") });
    expect(result.rules.sort()).toEqual(['G003:error', 'G006:warn']);
    expect(result.findings.find((f) => f.rule === 'G003')!.message).toBe("toHaveText on page.getByTestId('total') became toBeVisible, which only checks presence.");
  });
  it('aligns by subject, so an inserted assertion neither hides a weakening nor fakes a changed value', () => {
    const base = `import { test, expect } from '@playwright/test';

test('adds', async ({ page }) => {
  await expect(page.getByTestId('count')).toHaveText('1');
  await expect(page.getByTestId('total')).toHaveText('R$ 10');
});
`;
    const head = base
      .replace("  await expect(page.getByTestId('count'))", "  await expect(page.getByTestId('banner')).toHaveText('Sale');\n  await expect(page.getByTestId('count'))")
      .replace("toHaveText('R$ 10')", 'toBeVisible()');
    const result = gate({ [FILE]: base }, { [FILE]: head });
    expect(result.rules).toEqual(['G003:error']);
  });
  it('accepts a presence check turned into a value check', () => {
    const result = gate({ [FILE]: page("await expect(page.getByTestId('total')).toBeVisible();") }, { [FILE]: page("await expect(page.getByTestId('total')).toHaveText('R$ 10');") });
    expect(result.rules).toEqual([]);
  });
  it('flags an exact check turned into a range', () => {
    const result = gate({ [FILE]: spec('  expect(list.length).toBe(1);') }, { [FILE]: spec('  expect(list.length).toBeGreaterThanOrEqual(1);') });
    expect(result.rules).toEqual(['G003:error']);
    expect(result.findings[0]!.message).toBe('toBe on list.length became toBeGreaterThanOrEqual, which accepts more values than the exact one.');
  });
  it('accepts a range turned into an exact check', () => {
    expect(gate({ [FILE]: spec('  expect(list.length).toBeGreaterThanOrEqual(1);') }, { [FILE]: spec('  expect(list.length).toBe(1);') }).rules).toEqual([]);
  });
});

describe('G004 skip-or-only-introduced', () => {
  it('flags a new .skip', () => {
    const result = gate({ [FILE]: spec(STRONG) }, { [FILE]: spec(STRONG).replace("test('creates", "test.skip('creates") });
    expect(result.rules).toEqual(expect.arrayContaining(['G004:error', 'G009:error']));
  });
  it('flags a describe-level .only through inheritance', () => {
    const wrap = (d: string) => `import { test, expect } from '@playwright/test';\n\n${d}('orders', () => {\n  test('lists', async ({ page }) => {\n    await expect(page).toHaveTitle('Orders');\n  });\n});\n`;
    expect(gate({ [FILE]: wrap('test.describe') }, { [FILE]: wrap('test.describe.only') }).rules).toContain('G004:error');
  });
  it('accepts an unchanged skip', () => {
    const skipped = spec(STRONG).replace("test('creates", "// see #12\ntest.skip('creates");
    expect(gate({ [FILE]: skipped }, { [FILE]: skipped }).rules).toEqual([]);
  });
  it('flags a new .fail, which turns a failure into a pass', () => {
    const result = gate({ [FILE]: spec(STRONG) }, { [FILE]: spec(STRONG).replace("test('creates", "test.fail('creates") });
    expect(result.rules).toEqual(expect.arrayContaining(['G004:error', 'G009:error']));
    expect(result.findings.find((f) => f.rule === 'G004')!.message).toBe('Test gained .fail, which turns its failure into a pass.');
  });
  it('accepts an unchanged .fail', () => {
    const failing = spec(STRONG).replace("test('creates", "test.fail('creates");
    expect(gate({ [FILE]: failing }, { [FILE]: failing }).rules).toEqual([]);
  });
});

describe('G005 expected-value-changed', () => {
  const changed = spec(STRONG.replace('toBe(201)', 'toBe(200)'));
  it('warns in review mode, with the line before and after', () => {
    const result = gate({ [FILE]: spec(STRONG) }, { [FILE]: changed });
    expect(result.rules).toEqual(['G005:warn']);
    expect(result.findings[0]!.diff).toEqual({ before: 'expect(response.status()).toBe(201);', after: 'expect(response.status()).toBe(200);' });
  });
  it('fails in heal mode', () => {
    const result = gate({ [FILE]: spec(STRONG) }, { [FILE]: changed }, { mode: 'heal' });
    expect(result.rules).toEqual(['G005:error']);
    expect(result.failed).toBe(true);
  });
  it('ignores non-literal expected values', () => {
    const a = spec('  expect(response.status()).toBe(expectedStatus);');
    const b = spec('  expect(response.status()).toBe(otherStatus);');
    expect(gate({ [FILE]: a }, { [FILE]: b }).rules).toEqual([]);
  });
  it('compares template literals by their text and expressions', () => {
    const a = spec('  await expect(total).toHaveText(`R$ ${price * 2}`);');
    const b = spec('  await expect(total).toHaveText(`R$ ${price}`);');
    expect(gate({ [FILE]: a }, { [FILE]: b }, { mode: 'heal' }).rules).toEqual(['G005:error']);
    expect(gate({ [FILE]: a }, { [FILE]: a }, { mode: 'heal' }).rules).toEqual([]);
  });
  it('does not read a timeout option as an expected value', () => {
    const a = spec("  await expect(page.getByTestId('row')).toBeVisible();");
    const b = spec("  await expect(page.getByTestId('row')).toBeVisible({ timeout: 5_000 });");
    expect(gate({ [FILE]: a }, { [FILE]: b }).rules).not.toContain('G005:warn');
  });
  it('still compares an object passed to a value matcher', () => {
    const a = spec('  expect(config).toEqual({ timeout: 1 });');
    const b = spec('  expect(config).toEqual({ timeout: 2 });');
    expect(gate({ [FILE]: a }, { [FILE]: b }).rules).toEqual(['G005:warn']);
  });
});

describe('G006 new-lint-errors', () => {
  it('flags only findings that are new', () => {
    const debt = `${STRONG}\n  await new Promise((r) => setTimeout(r, 100));`;
    const more = `${debt}\n  await new Promise((r) => setTimeout(r, 200));`;
    expect(gate({ [FILE]: spec(debt) }, { [FILE]: spec(debt) }).rules).toEqual([]);
    expect(gate({ [FILE]: spec(debt) }, { [FILE]: spec(more) }).rules).toEqual(['G006:error']);
  });
});

describe('G007 protected-file-changed', () => {
  const config = (retries: number) => `export default { forbidOnly: !!process.env.CI, retries: ${retries} };\n`;
  it('flags a config change and names the signal', () => {
    const result = gate({ 'playwright.config.ts': config(1) }, { 'playwright.config.ts': config(3) });
    expect(result.rules).toEqual(['G007:error']);
    expect(result.findings[0]!.message).toContain('retries increased');
  });
  it('flags changed npm scripts', () => {
    const pkg = (test: string) => JSON.stringify({ scripts: { test } });
    expect(gate({ 'package.json': pkg('playwright test') }, { 'package.json': pkg('playwright test || true') }).rules).toEqual(['G007:error']);
  });
  it('accepts it with --allow-protected', () => {
    expect(gate({ 'playwright.config.ts': config(1) }, { 'playwright.config.ts': config(3) }, { allowProtected: true }).rules).toEqual([]);
  });
  it('ignores files that are not protected', () => {
    expect(gate({ 'src/app.ts': 'a' }, { 'src/app.ts': 'b' }).rules).toEqual([]);
  });
  it('flags a changed contract schema as an error in both modes', () => {
    const schema = (id: string) => `export const Created = z.object({ _id: ${id} });\n`;
    const before = { 'src/api/schemas.ts': schema('z.string().min(1)') };
    const after = { 'src/api/schemas.ts': schema('z.string().optional()') };
    expect(gate(before, after, { mode: 'heal' }).rules).toEqual(['G007:error']);
    expect(gate(before, after).rules).toEqual(['G007:error']);
    expect(gate(before, after, { mode: 'heal', allowProtected: true }).rules).toEqual([]);
  });
  it('takes extra contract globs from the config', () => {
    const files = (v: string) => ({ 'src/types/order.ts': v });
    expect(gate(files('a'), files('b'), { mode: 'heal' }).rules).toEqual([]);
    expect(gate(files('a'), files('b'), { mode: 'heal', config: { rules: {}, contracts: ['src/types/**'] } }).rules).toEqual(['G007:error']);
  });
});

describe('G010 wait-or-retry-raised', () => {
  const timed = (options: string) => spec(`  await expect(page.getByTestId('row')).toBeVisible(${options});`);
  it('flags a timeout raised on an assertion', () => {
    const result = gate({ [FILE]: timed('{ timeout: 5_000 }') }, { [FILE]: timed('{ timeout: 15_000 }') });
    expect(result.rules).toEqual(['G010:error']);
    expect(result.findings[0]!.message).toContain('timeout increased');
  });
  it('flags retries and slow marks added in a test file', () => {
    const retries = spec(STRONG).replace("test('creates", "test.describe.configure({ retries: 3 });\n\ntest('creates");
    expect(gate({ [FILE]: spec(STRONG) }, { [FILE]: retries }).rules).toEqual(['G010:error']);
    const slow = spec(`  test.slow();\n${STRONG}`);
    expect(gate({ [FILE]: spec(STRONG) }, { [FILE]: slow }).rules).toEqual(['G010:error']);
  });
  it('accepts a timeout that went down or stayed the same', () => {
    expect(gate({ [FILE]: timed('{ timeout: 15_000 }') }, { [FILE]: timed('{ timeout: 5_000 }') }).rules).toEqual([]);
    expect(gate({ [FILE]: timed('{ timeout: 5_000 }') }, { [FILE]: `${timed('{ timeout: 5_000 }')}// note\n` }).rules).toEqual([]);
  });
});

describe('G011 response-faked', () => {
  const ui = (setup: string) => `import { test, expect } from '@playwright/test';

test('shows the order', async ({ page }) => {
${setup}  await page.goto('/orders/1');
  await expect(page.getByTestId('status')).toHaveText('Paid');
});
`;
  const fake = "  await page.route('**/api/orders/1', (route) => route.fulfill({ json: { status: 'Paid' } }));\n";
  it('flags a new faked response: an error when healing, a warning in review', () => {
    expect(gate({ [FILE]: ui('') }, { [FILE]: ui(fake) }, { mode: 'heal' }).rules).toEqual(['G011:error']);
    expect(gate({ [FILE]: ui('') }, { [FILE]: ui(fake) }).rules).toEqual(['G011:warn']);
  });
  it('flags a Cypress intercept with a static reply, not one that only spies', () => {
    const cy = (setup: string) => `describe('orders', () => {\n  it('shows the order', () => {\n${setup}    cy.visit('/orders/1');\n    cy.get('[data-cy=status]').should('have.text', 'Paid');\n  });\n});\n`;
    const file = 'cypress/e2e/orders.cy.ts';
    expect(gate({ [file]: cy('') }, { [file]: cy("    cy.intercept('GET', '/api/orders/1', { statusCode: 200, body: { status: 'Paid' } });\n") }, { mode: 'heal' }).rules).toEqual(['G011:error']);
    expect(gate({ [file]: cy('') }, { [file]: cy("    cy.intercept('GET', '/api/orders/1').as('order');\n") }, { mode: 'heal' }).rules).toEqual([]);
  });
  it('accepts a fake that was already there', () => {
    expect(gate({ [FILE]: ui(fake) }, { [FILE]: `${ui(fake)}// note\n` }, { mode: 'heal' }).rules).toEqual([]);
  });
});

describe('G008 new-dependency', () => {
  const pkg = (deps: Record<string, string>) => JSON.stringify({ devDependencies: deps });
  it('flags an added dependency', () => {
    const result = gate({ 'package.json': pkg({ a: '1.0.0' }) }, { 'package.json': pkg({ a: '1.0.0', 'left-padx': '^1.0.0' }) });
    expect(result.rules).toEqual(['G008:error']);
    expect(result.findings[0]!.message).toContain('left-padx@^1.0.0 (new)');
  });
  it('flags a lockfile change without a package.json change', () => {
    expect(gate({ 'package-lock.json': '{}' }, { 'package-lock.json': '{"x":1}' }).rules).toEqual(['G008:error']);
  });
  it('accepts it with --allow-dependencies', () => {
    expect(gate({ 'package.json': pkg({ a: '1.0.0' }) }, { 'package.json': pkg({ a: '2.0.0' }) }, { allowDependencies: true }).rules).toEqual([]);
  });
  it('accepts a removed dependency', () => {
    expect(gate({ 'package.json': pkg({ a: '1.0.0', b: '1.0.0' }) }, { 'package.json': pkg({ a: '1.0.0' }) }).rules).toEqual([]);
  });
});

describe('G009 disable-introduced', () => {
  it('flags a new @ts-ignore and points at its line', () => {
    const head = spec(`  // @ts-ignore\n${STRONG}`);
    const result = gate({ [FILE]: spec(STRONG) }, { [FILE]: head });
    expect(result.rules).toEqual(['G009:error']);
    expect(result.findings[0]!.line).toBe(5);
  });
  it('ignores disables that already existed', () => {
    const both = spec(`  // eslint-disable-next-line\n${STRONG}`);
    expect(gate({ [FILE]: both }, { [FILE]: both }).rules).toEqual([]);
  });
});

describe('scope and matching', () => {
  it('matches repeated titles one by one', () => {
    const loop = (n: number) => `import { test, expect } from '@playwright/test';\n\nfor (const f of fields) {\n  test(\`rejects \${f}\`, async ({ request }) => {\n${'    expect((await request.post("/u")).status()).toBe(400);\n'.repeat(n)}  });\n}\n`;
    expect(gate({ [FILE]: loop(1) }, { [FILE]: loop(1) }).rules).toEqual([]);
  });
  it('limits test files with --paths', () => {
    const result = gate({ 'other/orders.ts': spec(STRONG) }, { 'other/orders.ts': spec('') }, { paths: ['other/**/*.ts'] });
    expect(result.rules).toContain('G002:error');
  });
  it('converts globs', () => {
    expect(globToRegExp('tests/**/*.spec.{ts,js}').test('tests/a/b.spec.ts')).toBe(true);
    expect(globToRegExp('tests/**/*.spec.{ts,js}').test('tests/b.spec.ts')).toBe(true);
    expect(globToRegExp('tests/*.ts').test('tests/a/b.ts')).toBe(false);
  });
});

describe('git sources', () => {
  it('compares a ref with the working tree', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'redfirst-git-'));
    try {
      const git = (...args: string[]) => execFileSync('git', args, { cwd: dir, stdio: 'pipe' });
      git('init', '-q');
      git('config', 'user.email', 'test@example.com');
      git('config', 'user.name', 'Test');
      execFileSync('git', ['config', 'commit.gpgsign', 'false'], { cwd: dir });
      writeFileSync(path.join(dir, 'orders.spec.ts'), spec(STRONG));
      git('add', '.');
      git('commit', '-q', '-m', 'base');
      writeFileSync(path.join(dir, 'orders.spec.ts'), spec('  expect(response.status()).toBe(201);'));

      writeFileSync(path.join(dir, 'new.spec.ts'), spec(STRONG));
      expect(gitChangedFiles(dir, 'HEAD')).toEqual(['new.spec.ts', 'orders.spec.ts']);

      const result = runGate({ base: gitRefSource(dir, 'HEAD'), head: worktreeSource(dir), changed: gitChangedFiles(dir, 'HEAD') });
      expect(result.findings.map((f) => f.rule)).toEqual(['G002']);
      expect(() => gitRefSource(dir, 'no-such-ref')).toThrow('Unknown git ref');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 30_000);
});
