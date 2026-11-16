#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import type { Framework } from './core/types.js';
import type { GateMode } from './gate/gate.js';
import { diagnoseProject, formatDiagnosis } from './diagnose/run.js';
import { verifyProject } from './verify/run.js';
import { formatVerification } from './verify/verify.js';
import { AGENTS, formatInit, initProject, type Agent } from './init.js';
import { format, FORMATS, type Format } from './report/format.js';
import { gateProject, lintProject, UsageError, type Report } from './run.js';

const USAGE = `redfirst: tests that can fail for the right reason

Usage:
  redfirst lint [paths...] [--format text|json|github] [--strict] [--config file] [--framework pw|cy]
  redfirst gate --base <ref> [--head <ref>] [--paths <glob>...] [--mode review|heal]
                [--allow-removal] [--format text|json|github] [--strict] [--config file]
                [--allow-protected] [--allow-dependencies]   (human overrides, after review)
  redfirst gate --base-dir <dir> --head-dir <dir> [same options]
  redfirst diagnose --report <playwright json> [--passing <json>] [--base <ref>] [--format text|json]
                                               why each test in the report failed, and what a fix may do
  redfirst verify --base <ref of the failing run> [--report <json after the fix>] [--failing <json>]
                  [--passing <json>] [--green <ref of the passing run>] [--runs 3] [--format text|json]
                  [--accept-app-change]        (human override, after review)
                                               whether a repair fixed the test without weakening it
  redfirst init [--agent claude,codex,grok] [--dry-run]
                                               set the project up for the agents (plugin, MCP, AGENTS.md)
  redfirst mcp                                 MCP server on stdio, for the project in the working directory

Exit codes: 0 clean, 1 violations found, 2 usage or internal error.
Rules: https://github.com/GuiNunesBR/redfirst/blob/main/docs/rules.md`;

export function version(): string {
  const pkg = path.resolve(import.meta.dirname, '../package.json');
  return existsSync(pkg) ? (JSON.parse(readFileSync(pkg, 'utf8')) as { version: string }).version : 'unknown';
}

function framework(value: string | undefined): Framework | undefined {
  if (value === undefined) return undefined;
  if (value === 'pw' || value === 'playwright') return 'playwright';
  if (value === 'cy' || value === 'cypress') return 'cypress';
  throw new UsageError(`--framework must be pw or cy, got ${value}`);
}

function outputFormat(value: string | undefined): Format {
  const as = (value ?? 'text') as Format;
  if (!FORMATS.includes(as)) throw new UsageError(`--format must be one of ${FORMATS.join(', ')}, got ${value}`);
  return as;
}

function print(result: Report, as: Format): number {
  console.log(format(result.findings, result.summary, as));
  return result.failed ? 1 : 0;
}

const common = {
  format: { type: 'string' },
  strict: { type: 'boolean', default: false },
  config: { type: 'string' },
  framework: { type: 'string' },
} as const;

async function lint(args: string[], cwd: string): Promise<number> {
  const { values, positionals } = parseArgs({ args, options: common, allowPositionals: true, strict: true });
  const as = outputFormat(values.format);
  const result = await lintProject(cwd, {
    paths: positionals,
    strict: values.strict,
    configFile: values.config,
    framework: framework(values.framework),
  });
  return print(result, as);
}

function gate(args: string[], cwd: string): number {
  const { values } = parseArgs({
    args,
    options: {
      ...common,
      base: { type: 'string' },
      head: { type: 'string' },
      'base-dir': { type: 'string' },
      'head-dir': { type: 'string' },
      paths: { type: 'string', multiple: true },
      mode: { type: 'string' },
      'allow-removal': { type: 'boolean', default: false },
      'allow-protected': { type: 'boolean', default: false },
      'allow-dependencies': { type: 'boolean', default: false },
    },
    strict: true,
  });
  const as = outputFormat(values.format);
  const result = gateProject(cwd, {
    base: values.base,
    head: values.head,
    baseDir: values['base-dir'],
    headDir: values['head-dir'],
    mode: values.mode as GateMode | undefined,
    paths: values.paths,
    allowRemoval: values['allow-removal'],
    allowProtected: values['allow-protected'],
    allowDependencies: values['allow-dependencies'],
    strict: values.strict,
    configFile: values.config,
    framework: framework(values.framework),
  });
  return print(result, as);
}

function init(args: string[], cwd: string): number {
  const { values } = parseArgs({ args, options: { agent: { type: 'string' }, 'dry-run': { type: 'boolean', default: false } }, strict: true });
  const agents = values.agent?.split(',').map((a) => a.trim());
  for (const a of agents ?? []) if (!(AGENTS as readonly string[]).includes(a)) throw new UsageError(`--agent takes ${AGENTS.join(', ')}; got ${a}`);
  const dryRun = values['dry-run'];
  console.log(formatInit(initProject(cwd, { agents: agents as Agent[] | undefined, dryRun }), dryRun));
  return 0;
}

function diagnose(args: string[], cwd: string): number {
  const { values } = parseArgs({
    args,
    options: { report: { type: 'string' }, passing: { type: 'string' }, base: { type: 'string' }, format: { type: 'string' } },
    strict: true,
  });
  if (!values.report) throw new UsageError('diagnose needs --report <Playwright JSON report>.');
  if (values.format !== undefined && values.format !== 'text' && values.format !== 'json') throw new UsageError(`--format must be text or json, got ${values.format}`);
  const diagnoses = diagnoseProject(cwd, { report: values.report, passing: values.passing, base: values.base });
  if (values.format === 'json') console.log(JSON.stringify(diagnoses, null, 2));
  else console.log(diagnoses.length ? diagnoses.map(formatDiagnosis).join('\n\n') : 'diagnose: no failed tests in the report.');
  return 0;
}

function verifyFix(args: string[], cwd: string): number {
  const { values } = parseArgs({
    args,
    options: {
      base: { type: 'string' },
      report: { type: 'string' },
      failing: { type: 'string' },
      passing: { type: 'string' },
      green: { type: 'string' },
      runs: { type: 'string' },
      format: { type: 'string' },
      'accept-app-change': { type: 'boolean', default: false },
    },
    strict: true,
  });
  if (values.format !== undefined && values.format !== 'text' && values.format !== 'json') throw new UsageError(`--format must be text or json, got ${values.format}`);
  const runs = values.runs === undefined ? undefined : Number(values.runs);
  if (runs !== undefined && (!Number.isInteger(runs) || runs < 1)) throw new UsageError(`--runs must be a positive whole number, got ${values.runs}`);
  const verifications = verifyProject(cwd, {
    base: values.base,
    report: values.report,
    failing: values.failing,
    passing: values.passing,
    green: values.green,
    runs,
    acceptAppChange: values['accept-app-change'],
  });
  if (values.format === 'json') console.log(JSON.stringify(verifications, null, 2));
  else console.log(verifications.map(formatVerification).join('\n\n'));
  return verifications.every((v) => v.verdict === 'verified') ? 0 : 1;
}

async function mcp(args: string[], cwd: string): Promise<number> {
  if (args.length) throw new UsageError(`mcp takes no arguments, got ${args.join(' ')}`);
  // Loaded here so lint and gate never pay for the MCP SDK.
  const { serve } = await import('./mcp/server.js');
  await serve(cwd, version());
  return 0;
}

export async function main(argv: string[], cwd = process.cwd()): Promise<number> {
  const [command, ...rest] = argv;
  try {
    if (command === 'lint') return await lint(rest, cwd);
    if (command === 'gate') return gate(rest, cwd);
    if (command === 'init') return init(rest, cwd);
    if (command === 'diagnose') return diagnose(rest, cwd);
    if (command === 'verify') return verifyFix(rest, cwd);
    if (command === 'mcp') return await mcp(rest, cwd);
    if (command === '--version' || command === '-v') {
      console.log(version());
      return 0;
    }
    if (command === undefined || command === '--help' || command === '-h' || command === 'help') {
      console.log(USAGE);
      return command === undefined ? 2 : 0;
    }
    throw new UsageError(`Unknown command: ${command}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(error instanceof UsageError || (error as { code?: string }).code?.startsWith('ERR_PARSE_ARGS') ? `${message}\n\n${USAGE}` : `redfirst: ${message}`);
    return 2;
  }
}

const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename);
if (invokedDirectly) {
  main(process.argv.slice(2)).then((code) => {
    process.exitCode = code;
  });
}
