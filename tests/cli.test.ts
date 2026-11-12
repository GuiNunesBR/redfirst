import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { main } from '../src/cli.js';

const ROOT = path.resolve(import.meta.dirname, '..');

let out: string[];
let err: string[];

beforeEach(() => {
  out = [];
  err = [];
  vi.spyOn(console, 'log').mockImplementation((...args) => void out.push(args.join(' ')));
  vi.spyOn(console, 'error').mockImplementation((...args) => void err.push(args.join(' ')));
});

afterEach(() => {
  vi.restoreAllMocks();
});

const run = (...args: string[]) => main(args, ROOT);

describe('lint', () => {
  it('exits 0 on clean files', async () => {
    expect(await run('lint', 'fixtures/playwright/good', 'fixtures/cypress/good')).toBe(0);
    expect(out.join('\n')).toContain('lint: PASS (0 errors, 0 warnings in 2 files)');
  });

  it('exits 1 on errors', async () => {
    expect(await run('lint', 'fixtures/playwright/bad/TL001.spec.ts')).toBe(1);
    expect(out.join('\n')).toMatch(/TL001.spec.ts:5:3 {2}error {2}TL001/);
  });

  it('exits 0 on warnings, 1 with --strict', async () => {
    expect(await run('lint', 'fixtures/playwright/bad/TL007.spec.ts')).toBe(0);
    expect(await run('lint', '--strict', 'fixtures/playwright/bad/TL007.spec.ts')).toBe(1);
  });

  it('prints json', async () => {
    await run('lint', '--format', 'json', 'fixtures/playwright/bad/TL003.spec.ts');
    const report = JSON.parse(out.join('\n'));
    expect(report.summary).toMatchObject({ tool: 'lint', errors: 2, warnings: 0 });
    expect(report.findings[1]).toMatchObject({ rule: 'TL003', line: 4, test: 'cart › adds an item' });
  });

  it('prints GitHub annotations', async () => {
    await run('lint', '--format', 'github', 'fixtures/cypress/bad/TL002.cy.ts');
    expect(out[0]).toMatch(/^::error file=fixtures\/cypress\/bad\/TL002\.cy\.ts,line=5,col=5,title=redfirst TL002::/);
  });

  it('reads rule settings from a config file', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'redfirst-cfg-'));
    try {
      writeFileSync(path.join(dir, 'rc.json'), JSON.stringify({ rules: { TL001: 'off' } }));
      expect(await run('lint', '--config', path.join(dir, 'rc.json'), 'fixtures/playwright/bad/TL001.spec.ts')).toBe(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('reports a disable comment without a reason as TL000', async () => {
    expect(await run('lint', 'fixtures/playwright/bad/TL000.spec.ts')).toBe(1);
    expect(out.join('\n')).toContain('TL000');
  });

  it('applies --framework to files it cannot detect', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'redfirst-fw-'));
    try {
      mkdirSync(path.join(dir, 'specs'));
      writeFileSync(path.join(dir, 'specs', 'a.ts'), "it('x', async () => { await cy.visit('/'); cy.get('a').should('have.text', 'b'); });\n");
      expect(await main(['lint', '--framework', 'cy', 'specs'], dir)).toBe(1);
      expect(out.join('\n')).toContain('TL010');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('exits 2 on usage errors', async () => {
    expect(await run('lint', '--format', 'xml', 'fixtures')).toBe(2);
    expect(await run('lint', '--nope')).toBe(2);
    expect(await run('lint', 'no/such/dir')).toBe(2);
    expect(await run('frobnicate')).toBe(2);
    expect(err.join('\n')).toContain('Usage:');
  });
});

describe('gate', () => {
  const pair = (base: string, head: string) => {
    const dir = mkdtempSync(path.join(tmpdir(), 'redfirst-gate-'));
    for (const [side, text] of [['base', base], ['head', head]] as const) {
      mkdirSync(path.join(dir, side, 'tests'), { recursive: true });
      writeFileSync(path.join(dir, side, 'tests', 'a.spec.ts'), text);
    }
    return dir;
  };
  const spec = (assertion: string) =>
    `import { test, expect } from '@playwright/test';\ntest('a', async ({ page }) => {\n  ${assertion}\n});\n`;

  it('passes an unchanged suite and fails a weakened one', async () => {
    const same = pair(spec("await expect(page).toHaveURL('/a');"), spec("await expect(page).toHaveURL('/a');"));
    const weaker = pair(spec("await expect(page).toHaveURL('/a');"), spec("await expect(page.getByRole('main')).toBeVisible();"));
    try {
      expect(await run('gate', '--base-dir', path.join(same, 'base'), '--head-dir', path.join(same, 'head'))).toBe(0);
      expect(out.join('\n')).toContain('gate: PASS');
      expect(await run('gate', '--base-dir', path.join(weaker, 'base'), '--head-dir', path.join(weaker, 'head'))).toBe(1);
      expect(out.join('\n')).toContain('gate: FAIL');
      expect(out.join('\n')).toContain('G003');
    } finally {
      rmSync(same, { recursive: true, force: true });
      rmSync(weaker, { recursive: true, force: true });
    }
  });

  it('fails a changed expected value only in heal mode', async () => {
    const dir = pair(spec("await expect(page).toHaveURL('/a');"), spec("await expect(page).toHaveURL('/b');"));
    try {
      const args = ['gate', '--base-dir', path.join(dir, 'base'), '--head-dir', path.join(dir, 'head')];
      expect(await run(...args)).toBe(0);
      expect(await run(...args, '--mode', 'heal')).toBe(1);
      expect(await run(...args, '--strict')).toBe(1);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('exits 2 without a base', async () => {
    expect(await run('gate')).toBe(2);
    expect(await run('gate', '--base-dir', 'fixtures')).toBe(2);
    expect(await run('gate', '--base', 'HEAD', '--mode', 'yolo')).toBe(2);
  });
});
