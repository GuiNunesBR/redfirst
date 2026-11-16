import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { UsageError } from './run.js';

export const AGENTS = ['claude', 'codex', 'grok'] as const;
export type Agent = (typeof AGENTS)[number];

export interface InitRequest {
  agents?: Agent[];
  dryRun?: boolean;
}

export interface InitResult {
  /** Files written, with what changed. */
  written: string[];
  /** Files that already had it. */
  unchanged: string[];
  /** Steps outside the project (user-level config) that init does not take for you. */
  todo: string[];
}

const REPO = 'GuiNunesBR/redfirst';
const BEGIN = '<!-- redfirst:begin -->';
const END = '<!-- redfirst:end -->';

type Json = Record<string, unknown>;

function readJson(file: string): Json {
  if (!existsSync(file)) return {};
  try {
    const value = JSON.parse(readFileSync(file, 'utf8')) as unknown;
    if (value && typeof value === 'object' && !Array.isArray(value)) return value as Json;
  } catch {
    // reported below
  }
  throw new UsageError(`${file} is not a JSON object; fix it first, init does not overwrite it.`);
}

/** Sets `value` under `keys` unless something is already there. Returns whether it changed anything. */
function ensure(json: Json, keys: string[], value: unknown): boolean {
  let node = json;
  for (const key of keys.slice(0, -1)) {
    const next = node[key];
    if (next === undefined) node[key] = {};
    else if (typeof next !== 'object' || next === null || Array.isArray(next)) throw new UsageError(`"${keys.join('.')}" cannot be set: "${key}" is not an object.`);
    node = node[key] as Json;
  }
  const last = keys.at(-1)!;
  if (node[last] !== undefined) return false;
  node[last] = value;
  return true;
}

/**
 * Sets the project up for the agents: the plugin and MCP server where a project file can declare them, the
 * rules in AGENTS.md, and the commands for what lives in the user's own config. Never overwrites a value.
 */
export function initProject(cwd: string, request: InitRequest = {}): InitResult {
  const agents = new Set(request.agents?.length ? request.agents : AGENTS);
  const result: InitResult = { written: [], unchanged: [], todo: [] };
  const pending: [string, string][] = [];

  const json = (relative: string, entries: [string[], unknown, string][]) => {
    const file = path.join(cwd, relative);
    const data = readJson(file);
    const changed = entries.filter(([keys, value]) => ensure(data, keys, value)).map(([, , label]) => label);
    if (changed.length) {
      pending.push([file, `${JSON.stringify(data, null, 2)}\n`]);
      result.written.push(`${relative}: ${changed.join(', ')}`);
    } else result.unchanged.push(relative);
  };

  // npx --no: the server must come from the project's install, never a download.
  const server = { command: 'npx', args: ['--no', 'redfirst', 'mcp'] };

  if (agents.has('claude')) {
    json('.claude/settings.json', [
      [['extraKnownMarketplaces', 'redfirst'], { source: { source: 'github', repo: REPO } }, 'redfirst marketplace'],
      [['enabledPlugins', 'redfirst@redfirst'], true, 'redfirst plugin enabled'],
    ]);
  }
  if (agents.has('claude') || agents.has('grok')) json('.mcp.json', [[['mcpServers', 'redfirst'], server, 'redfirst MCP server']]);

  const rules = readFileSync(path.resolve(import.meta.dirname, '../AGENTS.md'), 'utf8').trimEnd();
  const agentsFile = path.join(cwd, 'AGENTS.md');
  const current = existsSync(agentsFile) ? readFileSync(agentsFile, 'utf8') : undefined;
  if (current?.includes(BEGIN)) result.unchanged.push('AGENTS.md');
  else {
    const block = `${BEGIN}\n${rules}\n${END}\n`;
    pending.push([agentsFile, current === undefined ? block : `${current.trimEnd()}\n\n${block}`]);
    result.written.push(`AGENTS.md: redfirst rules ${current === undefined ? 'created' : 'appended'}`);
  }

  if (agents.has('claude')) {
    // The project file registers the marketplace once the folder is trusted; installing stays a per-user step.
    result.todo.push('Claude Code: claude plugin install redfirst@redfirst --scope project   (once per person, after trusting the folder)');
  }
  if (agents.has('codex')) {
    result.todo.push(`Codex: codex plugin marketplace add ${REPO} && codex plugin add redfirst@redfirst, then trust the hooks in /hooks`);
    result.todo.push('Codex: codex mcp add redfirst -- npx --no redfirst mcp');
  }
  if (agents.has('grok')) {
    result.todo.push(`Grok Build: add ${REPO} under [[marketplace.sources]] in ~/.grok/config.toml, then install redfirst in /plugins`);
  }
  const pkg = path.join(cwd, 'package.json');
  if (!existsSync(pkg) || !/"redfirst"\s*:/.test(readFileSync(pkg, 'utf8'))) result.todo.unshift('npm i -D redfirst   (the hooks and the MCP server use the project install)');

  if (!request.dryRun) {
    for (const [file, text] of pending) {
      mkdirSync(path.dirname(file), { recursive: true });
      writeFileSync(file, text);
    }
  }
  return result;
}

export function formatInit(result: InitResult, dryRun: boolean): string {
  const lines = [
    ...result.written.map((w) => `${dryRun ? 'would write' : 'wrote'}  ${w}`),
    ...result.unchanged.map((u) => `ok     ${u} (already set up)`),
  ];
  if (result.todo.length) lines.push('', 'Left to you (outside this project):', ...result.todo.map((t) => `  ${t}`));
  if (result.written.some((w) => w.startsWith('.claude'))) {
    lines.push('', 'Commit .claude/settings.json and .mcp.json so the team gets the marketplace and the server.');
    lines.push('.claude/settings.json is a protected file: redfirst gate asks a human to approve the change.');
  }
  return lines.join('\n');
}
