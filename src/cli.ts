#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { loadConfig } from './config.js';
import type { Finding, Framework } from './core/types.js';
import { runGate, type GateMode } from './gate/gate.js';
import { dirSource, gitRefSource, gitRoot, worktreeSource } from './gate/sources.js';
import { DEFAULT_DIRS, lintFiles } from './lint/engine.js';
import { format, FORMATS, summarize, type Format } from './report/format.js';

const USAGE = `redfirst: tests that can fail for the right reason

Usage:
  redfirst lint [paths...] [--format text|json|github] [--strict] [--config file] [--framework pw|cy]
  redfirst gate --base <ref> [--head <ref>] [--paths <glob>...] [--mode review|heal]
                [--allow-removal] [--format text|json|github] [--strict] [--config file]
  redfirst gate --base-dir <dir> --head-dir <dir> [same options]

Exit codes: 0 clean, 1 violations found, 2 usage or internal error.
Rules: https://github.com/GuiNunesBR/redfirst/blob/main/docs/rules.md`;

class UsageError extends Error {}

function version(): string {
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

function finish(tool: 'lint' | 'gate', findings: Finding[], as: Format, strict: boolean, files?: number): number {
  const failed = findings.some((f) => f.severity === 'error') || (strict && findings.length > 0);
  console.log(format(findings, summarize(tool, findings, failed, files), as));
  return failed ? 1 : 0;
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
  const config = loadConfig(cwd, values.config);
  const paths = positionals.length ? positionals : DEFAULT_DIRS.filter((d) => existsSync(path.join(cwd, d)));
  if (paths.length === 0) throw new UsageError(`No paths given and none of ${DEFAULT_DIRS.join(', ')} exist.`);
  const { files, findings } = await lintFiles(cwd, paths, { config, framework: framework(values.framework) });
  if (files.length === 0) throw new UsageError(`No files matched: ${paths.join(' ')}`);
  return finish('lint', findings, as, values.strict, files.length);
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
    },
    strict: true,
  });
  const as = outputFormat(values.format);
  const mode = (values.mode ?? 'review') as GateMode;
  if (mode !== 'review' && mode !== 'heal') throw new UsageError(`--mode must be review or heal, got ${values.mode}`);
  const config = loadConfig(cwd, values.config);

  let base;
  let head;
  if (values['base-dir'] || values['head-dir']) {
    if (!values['base-dir'] || !values['head-dir']) throw new UsageError('--base-dir and --head-dir go together.');
    base = dirSource(path.resolve(cwd, values['base-dir']));
    head = dirSource(path.resolve(cwd, values['head-dir']));
  } else {
    if (!values.base) throw new UsageError('gate needs --base <ref> (or --base-dir and --head-dir).');
    const root = gitRoot(cwd);
    base = gitRefSource(root, values.base);
    head = values.head ? gitRefSource(root, values.head) : worktreeSource(root);
  }

  const result = runGate({
    base,
    head,
    mode,
    paths: values.paths,
    allowRemoval: values['allow-removal'],
    allowProtected: values['allow-protected'],
    config,
    framework: framework(values.framework),
  });
  return finish('gate', result.findings, as, values.strict, result.changedFiles.length);
}

export async function main(argv: string[], cwd = process.cwd()): Promise<number> {
  const [command, ...rest] = argv;
  try {
    if (command === 'lint') return await lint(rest, cwd);
    if (command === 'gate') return gate(rest, cwd);
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
