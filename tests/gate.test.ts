import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { globToRegExp, runGate, type GateOptions } from '../src/gate/gate.js';
import { gitRefSource, worktreeSource, type FileSource } from '../src/gate/sources.js';

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
    expect(result.rules).toEqual(['G003:error', 'G006:warn']);
    expect(result.findings[0]!.message).toContain('toHaveText is gone');
  });
  it('accepts a presence check turned into a value check', () => {
    const result = gate({ [FILE]: page("await expect(page.getByTestId('total')).toBeVisible();") }, { [FILE]: page("await expect(page.getByTestId('total')).toHaveText('R$ 10');") });
    expect(result.rules).toEqual([]);
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
});

describe('G005 expected-value-changed', () => {
  const changed = spec(STRONG.replace('toBe(201)', 'toBe(200)'));
  it('warns in review mode', () => {
    expect(gate({ [FILE]: spec(STRONG) }, { [FILE]: changed }).rules).toEqual(['G005:warn']);
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

      const result = runGate({ base: gitRefSource(dir, 'HEAD'), head: worktreeSource(dir) });
      expect(result.findings.map((f) => f.rule)).toEqual(['G002']);
      expect(() => gitRefSource(dir, 'no-such-ref')).toThrow('Unknown git ref');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 30_000);
});
