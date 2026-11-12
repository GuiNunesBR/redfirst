import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { PROTECTED_PATHS } from '../src/gate/protected.js';

const ROOT = path.resolve(import.meta.dirname, '..');
const HOOKS = path.join(ROOT, 'hooks', 'claude-code');

function hook(script: string, filePath: string, env: Record<string, string> = {}) {
  const input = JSON.stringify({ hook_event_name: 'PreToolUse', cwd: ROOT, tool_name: 'Edit', tool_input: { file_path: filePath } });
  const result = spawnSync(process.execPath, [path.join(HOOKS, script)], {
    input,
    encoding: 'utf8',
    env: { ...process.env, CLAUDE_PROJECT_DIR: ROOT, ...env },
  });
  return { code: result.status, stderr: result.stderr };
}

describe('pre-edit-protect', () => {
  it('blocks protected files and tells the agent to propose the change', () => {
    const result = hook('pre-edit-protect.mjs', path.join(ROOT, '.github', 'workflows', 'ci.yml'));
    expect(result.code).toBe(2);
    expect(result.stderr).toContain('.github/workflows/ci.yml is protected');
    expect(result.stderr).not.toContain('REDFIRST_ALLOW_PROTECTED');
  });

  it('handles Windows paths', () => {
    expect(hook('pre-edit-protect.mjs', `${ROOT.replace(/\//g, '\\')}\\playwright.config.ts`).code).toBe(2);
  });

  it('lets other files through', () => {
    expect(hook('pre-edit-protect.mjs', path.join(ROOT, 'tests', 'new.spec.ts')).code).toBe(0);
  });

  it('lets a human through with the override variable', () => {
    expect(hook('pre-edit-protect.mjs', path.join(ROOT, 'tsconfig.json'), { REDFIRST_ALLOW_PROTECTED: '1' }).code).toBe(0);
  });

  it('uses the same protected list as the gate', () => {
    const text = readFileSync(path.join(HOOKS, 'pre-edit-protect.mjs'), 'utf8');
    const list = text.slice(text.indexOf('const PROTECTED_PATHS'), text.indexOf('];'));
    const sources = [...list.matchAll(/^\s+\/(.+)\/,$/gm)].map((m) => m[1]);
    expect(sources).toEqual(PROTECTED_PATHS.map((re) => re.source));
  });
});

describe('post-edit-lint', () => {
  beforeAll(() => {
    execFileSync(process.execPath, [path.join(ROOT, 'node_modules', 'typescript', 'bin', 'tsc'), '-p', 'tsconfig.build.json'], { cwd: ROOT });
  }, 60_000);

  it('sends lint errors back to the agent', () => {
    const result = hook('post-edit-lint.mjs', path.join(ROOT, 'fixtures', 'playwright', 'bad', 'TL001.spec.ts'));
    expect(result.code).toBe(2);
    expect(result.stderr).toContain('TL001');
    expect(result.stderr).toContain('without weakening any assertion');
  });

  it('stays quiet on clean test files and on files that are not tests', () => {
    expect(hook('post-edit-lint.mjs', path.join(ROOT, 'fixtures', 'playwright', 'good', 'checkout.spec.ts')).code).toBe(0);
    expect(hook('post-edit-lint.mjs', path.join(ROOT, 'src', 'cli.ts')).code).toBe(0);
  });

  it('stays quiet on warnings', () => {
    expect(hook('post-edit-lint.mjs', path.join(ROOT, 'fixtures', 'playwright', 'bad', 'TL007.spec.ts')).code).toBe(0);
  });
});
