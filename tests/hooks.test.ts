import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { PROTECTED_PATHS } from '../src/gate/protected.js';

const ROOT = path.resolve(import.meta.dirname, '..');
const HOOKS = path.join(ROOT, 'hooks');

function run(args: string[], payload: object, env: Record<string, string> = {}) {
  const result = spawnSync(process.execPath, args, {
    input: JSON.stringify({ hook_event_name: 'PreToolUse', cwd: ROOT, ...payload }),
    encoding: 'utf8',
    env: { ...process.env, CLAUDE_PROJECT_DIR: ROOT, ...env },
  });
  return { code: result.status, stderr: result.stderr };
}

/** Claude Code and Grok Build: the edited file is in tool_input.file_path. */
const hook = (script: string, filePath: string, env: Record<string, string> = {}) =>
  run([path.join(HOOKS, script)], { tool_name: 'Edit', tool_input: { file_path: filePath } }, env);

/** Codex: apply_patch sends the patch text in tool_input.command, with paths relative to cwd. */
function codexHook(script: string, patch: string) {
  const { CLAUDE_PROJECT_DIR: _, ...env } = process.env;
  const result = spawnSync(process.execPath, [path.join(HOOKS, script)], {
    input: JSON.stringify({ hook_event_name: 'PreToolUse', cwd: ROOT, tool_name: 'apply_patch', tool_input: { command: patch } }),
    encoding: 'utf8',
    env,
  });
  return { code: result.status, stderr: result.stderr };
}

const patch = (...headers: string[]) => ['*** Begin Patch', ...headers.flatMap((h) => [h, '@@', '+// x']), '*** End Patch'].join('\n');

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

  it('blocks a Codex patch that touches a protected file among others', () => {
    const result = codexHook('pre-edit-protect.mjs', patch('*** Update File: tests/cart.spec.ts', '*** Update File: playwright.config.ts'));
    expect(result.code).toBe(2);
    expect(result.stderr).toContain('playwright.config.ts is protected');
  });

  it('blocks a Codex patch that moves a file onto a protected path', () => {
    expect(codexHook('pre-edit-protect.mjs', patch('*** Update File: notes.txt', '*** Move to: .codex/hooks.json')).code).toBe(2);
  });

  it('lets a Codex patch on other files through', () => {
    expect(codexHook('pre-edit-protect.mjs', patch('*** Add File: tests/new.spec.ts')).code).toBe(0);
  });

  it('runs from the plugin hooks file, through CLAUDE_PLUGIN_ROOT', () => {
    const config = JSON.parse(readFileSync(path.join(HOOKS, 'hooks.json'), 'utf8'));
    const command: string = config.hooks.PreToolUse[0].hooks[0].command;
    const code = /^node -e "(.+)"$/.exec(command)?.[1];
    expect(code).toBeDefined();
    const result = run(['-e', code!], { tool_name: 'Write', tool_input: { file_path: path.join(ROOT, 'tsconfig.json') } }, { CLAUDE_PLUGIN_ROOT: ROOT });
    expect(result.code).toBe(2);
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

  it('lints the test files in a Codex patch', () => {
    const result = codexHook('post-edit-lint.mjs', patch('*** Update File: fixtures/playwright/bad/TL001.spec.ts', '*** Update File: README.md'));
    expect(result.code).toBe(2);
    expect(result.stderr).toContain('TL001');
  });

  it('stays quiet on warnings', () => {
    expect(hook('post-edit-lint.mjs', path.join(ROOT, 'fixtures', 'playwright', 'bad', 'TL007.spec.ts')).code).toBe(0);
  });
});
