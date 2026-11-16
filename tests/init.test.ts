import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { initProject } from '../src/init.js';

let dir: string;
const file = (relative: string) => path.join(dir, relative);
const json = (relative: string) => JSON.parse(readFileSync(file(relative), 'utf8'));

beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), 'redfirst-init-'));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe('init', () => {
  it('sets up a fresh project for Claude Code and Grok Build, and lists the rest', () => {
    const result = initProject(dir);
    expect(json('.claude/settings.json')).toEqual({
      extraKnownMarketplaces: { redfirst: { source: { source: 'github', repo: 'GuiNunesBR/redfirst' } } },
      enabledPlugins: { 'redfirst@redfirst': true },
    });
    expect(json('.mcp.json')).toEqual({ mcpServers: { redfirst: { command: 'npx', args: ['--no', 'redfirst', 'mcp'] } } });
    expect(readFileSync(file('AGENTS.md'), 'utf8')).toContain('A green test that can\'t fail is a lie.');
    expect(result.todo.join('\n')).toMatch(/npm i -D redfirst[\s\S]*claude plugin install redfirst@redfirst --scope project[\s\S]*codex plugin marketplace add[\s\S]*codex mcp add[\s\S]*~\/\.grok\/config\.toml/);
  });

  it('keeps what is there and changes nothing on a second run', () => {
    mkdirSync(file('.claude'));
    writeFileSync(file('.claude/settings.json'), JSON.stringify({ permissions: { allow: ['Bash(npm test)'] }, enabledPlugins: { other: true } }));
    writeFileSync(file('AGENTS.md'), '# House rules\n\nUse pnpm.\n');
    initProject(dir);
    expect(json('.claude/settings.json')).toMatchObject({ permissions: { allow: ['Bash(npm test)'] }, enabledPlugins: { other: true, 'redfirst@redfirst': true } });
    const agents = readFileSync(file('AGENTS.md'), 'utf8');
    expect(agents.startsWith('# House rules\n\nUse pnpm.\n\n<!-- redfirst:begin -->')).toBe(true);

    const again = initProject(dir);
    expect(again.written).toEqual([]);
    expect(readFileSync(file('AGENTS.md'), 'utf8')).toBe(agents);
  });

  it('does not replace a server or a plugin setting the user chose', () => {
    writeFileSync(file('.mcp.json'), JSON.stringify({ mcpServers: { redfirst: { command: 'node', args: ['custom.js'] } } }));
    initProject(dir, { agents: ['grok'] });
    expect(json('.mcp.json').mcpServers.redfirst).toEqual({ command: 'node', args: ['custom.js'] });
  });

  it('refuses a broken JSON file and writes nothing', () => {
    writeFileSync(file('.mcp.json'), '{ "mcpServers": ');
    expect(() => initProject(dir)).toThrow(/not a JSON object/);
    expect(existsSync(file('.claude'))).toBe(false);
    expect(existsSync(file('AGENTS.md'))).toBe(false);
  });

  it('writes nothing on a dry run', () => {
    const result = initProject(dir, { dryRun: true });
    expect(result.written.length).toBe(3);
    expect(existsSync(file('.claude'))).toBe(false);
    expect(existsSync(file('.mcp.json'))).toBe(false);
  });

  it('only touches the files of the agents asked for', () => {
    initProject(dir, { agents: ['codex'] });
    expect(existsSync(file('.claude'))).toBe(false);
    expect(existsSync(file('.mcp.json'))).toBe(false);
    expect(existsSync(file('AGENTS.md'))).toBe(true);
  });

  it('does not ask to install redfirst when the project already has it', () => {
    writeFileSync(file('package.json'), JSON.stringify({ devDependencies: { redfirst: '^0.2.0' } }));
    expect(initProject(dir, { agents: ['grok'] }).todo.join('\n')).not.toContain('npm i');
  });
});
