import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Client, InMemoryTransport } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createServer } from '../src/mcp/server.js';
import { writeRun } from './support/trace.js';

const ROOT = path.resolve(import.meta.dirname, '..');

async function connect(root: string) {
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  await createServer(root, 'test').connect(serverSide);
  const client = new Client({ name: 'test', version: '0' });
  await client.connect(clientSide);
  return client;
}

const textOf = (result: { content?: unknown }) =>
  (result.content as { type: string; text?: string }[]).map((c) => c.text ?? '').join('\n');

const spec = (assertion: string) =>
  `import { test, expect } from '@playwright/test';\ntest('a', async ({ page }) => {\n  ${assertion}\n});\n`;

describe('MCP server', () => {
  let client: Client;
  beforeAll(async () => {
    client = await connect(ROOT);
  });
  afterAll(() => client.close());

  it('offers its tools read-only, without the human overrides', async () => {
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual(['classify_failure', 'gate', 'lint', 'verify_fix']);
    for (const tool of tools) expect(tool.annotations?.readOnlyHint).toBe(true);
    const gate = tools.find((t) => t.name === 'gate')!;
    expect(Object.keys(gate.inputSchema.properties ?? {}).sort()).toEqual(['base', 'framework', 'head', 'mode', 'paths']);
    const verifyFix = tools.find((t) => t.name === 'verify_fix')!;
    expect(Object.keys(verifyFix.inputSchema.properties ?? {}).sort()).toEqual(['base', 'failing', 'green', 'passing', 'report']);
  });

  it('lints the paths it is given', async () => {
    const result = await client.callTool({ name: 'lint', arguments: { paths: ['fixtures/playwright/bad/TL001.spec.ts'] } });
    expect(result.isError).toBeFalsy();
    expect(textOf(result)).toContain('TL001');
    expect(textOf(result)).toContain('lint: FAIL');
  });

  it('reports a clean file as a pass', async () => {
    const result = await client.callTool({ name: 'lint', arguments: { paths: ['fixtures/playwright/good/checkout.spec.ts'] } });
    expect(textOf(result)).toContain('lint: PASS');
  });

  it('refuses paths outside the project', async () => {
    for (const p of ['../outside', path.join(ROOT, 'fixtures')]) {
      const result = await client.callTool({ name: 'lint', arguments: { paths: [p] } });
      expect(result.isError, p).toBe(true);
      expect(textOf(result)).toContain('outside the project');
    }
  });

  it('refuses a report outside the project', async () => {
    const result = await client.callTool({ name: 'classify_failure', arguments: { report: '../report.json' } });
    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain('outside the project');
  });

  it('refuses a ref that git would read as an option', async () => {
    const result = await client.callTool({ name: 'gate', arguments: { base: '--output=x' } });
    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain('Unknown git ref');
  });
});

describe('MCP gate on a git repository', () => {
  let dir: string;
  let client: Client;
  const git = (...args: string[]) => execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...args], { cwd: dir });

  beforeAll(async () => {
    dir = mkdtempSync(path.join(tmpdir(), 'redfirst-mcp-'));
    mkdirSync(path.join(dir, 'tests'));
    writeFileSync(path.join(dir, 'tests', 'a.spec.ts'), spec("await expect(page.getByTestId('total')).toHaveText('R$ 10');"));
    git('init', '-q');
    git('add', '.');
    git('commit', '-q', '-m', 'base');
    client = await connect(dir);
  }, 30_000);

  afterAll(async () => {
    await client.close();
    rmSync(dir, { recursive: true, force: true });
  });

  it('passes an unchanged working tree and fails a weakened assertion', async () => {
    expect(textOf(await client.callTool({ name: 'gate', arguments: { base: 'HEAD' } }))).toContain('gate: PASS');
    writeFileSync(path.join(dir, 'tests', 'a.spec.ts'), spec("await expect(page.getByTestId('total')).toBeVisible();"));
    const text = textOf(await client.callTool({ name: 'gate', arguments: { base: 'HEAD' } }));
    expect(text).toContain('G003');
    expect(text).toContain('gate: FAIL');
  }, 30_000);
});

describe('MCP classify_failure on a report with traces', () => {
  let dir: string;
  let client: Client;
  beforeAll(async () => {
    dir = mkdtempSync(path.join(tmpdir(), 'redfirst-diagnose-'));
    writeRun(path.join(dir, 'green'), '/users');
    writeRun(path.join(dir, 'red'), '/v2/people', { failure: 'wait' });
    client = await connect(dir);
  });
  afterAll(async () => {
    await client.close();
    rmSync(dir, { recursive: true, force: true });
  });

  it('shows the app moved to another endpoint and asks instead of telling the agent to fix the test', async () => {
    const text = textOf(await client.callTool({ name: 'classify_failure', arguments: { report: 'red/report.json', passing: 'green/report.json' } }));
    expect(text).toContain('diagnosis: product-change (high confidence); action: human');
    expect(text).toContain('The app called GET /v2/people (200) where the passing run called GET /users (200), and the answer has the same shape.');
    expect(text).toMatch(/wrong endpoint/);
    expect(text).not.toContain('action: update-test');
  });

  it('says what it cannot tell without a passing run', async () => {
    const text = textOf(await client.callTool({ name: 'classify_failure', arguments: { report: 'red/report.json' } }));
    expect(text).toContain('No passing run to compare with');
    expect(text).not.toContain('action: update-test');
  });
});

describe('MCP verify_fix on a repaired test', () => {
  let dir: string;
  let client: Client;
  const git = (...args: string[]) => execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...args], { cwd: dir });
  const users = (locator: string, extra = '') =>
    `import { test, expect } from '@playwright/test';\ntest('lists the users', async ({ page }) => {\n  await page.goto('/users');\n${extra}  await page.${locator}.click();\n  await expect(page.getByRole('row')).toHaveCount(1);\n});\n`;
  const verifyFix = async (args: Record<string, string>) => textOf(await client.callTool({ name: 'verify_fix', arguments: { base: 'HEAD', passing: 'runs/green/report.json', ...args } }));

  beforeAll(async () => {
    dir = mkdtempSync(path.join(tmpdir(), 'redfirst-verify-'));
    mkdirSync(path.join(dir, 'tests'));
    writeFileSync(path.join(dir, 'tests', 'users.spec.ts'), users("getByTestId('row')"));
    writeFileSync(path.join(dir, '.gitignore'), 'runs/\n');
    git('init', '-q');
    git('add', '.');
    git('commit', '-q', '-m', 'the test as it failed');
    const runs = path.join(dir, 'runs');
    writeRun(path.join(runs, 'green'), '/users');
    writeRun(path.join(runs, 'red-locator'), '/users', { failure: 'click' });
    writeRun(path.join(runs, 'red-moved'), '/v2/people', { failure: 'wait' });
    writeRun(path.join(runs, 'after'), '/users', { repeats: 3 });
    writeRun(path.join(runs, 'after-once'), '/users');
    writeRun(path.join(runs, 'after-faked'), '/users', { repeats: 3, faked: true });
    writeRun(path.join(runs, 'after-moved'), '/v2/people', { repeats: 3 });
    client = await connect(dir);
    // The repair: a locator that finds the same row by its role.
    writeFileSync(path.join(dir, 'tests', 'users.spec.ts'), users("getByRole('row', { name: 'Ana' })"));
  }, 30_000);

  afterAll(async () => {
    await client.close();
    rmSync(dir, { recursive: true, force: true });
  });

  it('verifies a locator repair that is green three times against the same app', async () => {
    const text = await verifyFix({ failing: 'runs/red-locator/report.json', report: 'runs/after/report.json' });
    expect(text).toContain('diagnosed as locator');
    expect(text).toContain('Passed 3 of 3 runs.');
    expect(text).toContain('verdict: VERIFIED');
  });

  it('does not call one green run verified', async () => {
    const text = await verifyFix({ failing: 'runs/red-locator/report.json', report: 'runs/after-once/report.json' });
    expect(text).toContain('verdict: INCOMPLETE');
  });

  it('rejects a green run whose answer came from the test', async () => {
    const text = await verifyFix({ failing: 'runs/red-locator/report.json', report: 'runs/after-faked/report.json' });
    expect(text).toContain('page GET /users was answered by the test (route.fulfill), not the app.');
    expect(text).toContain('verdict: REJECTED');
  });

  it('rejects a test changed to follow an app that moved to another endpoint', async () => {
    const text = await verifyFix({ failing: 'runs/red-moved/report.json', report: 'runs/after-moved/report.json' });
    expect(text).toContain('diagnosed as product-change');
    expect(text).toContain('The app called GET /v2/people (200) where the passing run called GET /users (200)');
    expect(text).toContain('verdict: REJECTED');
  });

  it('rejects a repair the gate catches', async () => {
    writeFileSync(path.join(dir, 'tests', 'users.spec.ts'), users("getByRole('row', { name: 'Ana' })").replace('.toHaveCount(1)', '.toBeVisible()'));
    const text = await verifyFix({ failing: 'runs/red-locator/report.json', report: 'runs/after/report.json' });
    expect(text).toContain('G003');
    expect(text).toContain('verdict: REJECTED');
  });
});

describe('redfirst mcp over stdio', () => {
  beforeAll(() => {
    execFileSync(process.execPath, [path.join(ROOT, 'node_modules', 'typescript', 'bin', 'tsc'), '-p', 'tsconfig.build.json'], { cwd: ROOT });
  }, 60_000);

  it('serves the tools for the project it starts in', async () => {
    const client = new Client({ name: 'test', version: '0' });
    await client.connect(new StdioClientTransport({ command: process.execPath, args: [path.join(ROOT, 'dist', 'cli.js'), 'mcp'], cwd: ROOT }));
    try {
      const result = await client.callTool({ name: 'lint', arguments: { paths: ['fixtures/playwright/bad/TL003.spec.ts'] } });
      expect(textOf(result)).toContain('TL003');
    } finally {
      await client.close();
    }
  }, 30_000);
});
