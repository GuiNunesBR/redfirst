import { existsSync } from 'node:fs';
import path from 'node:path';
import { loadConfig } from './config.js';
import type { Finding, Framework } from './core/types.js';
import { runGate, type GateMode } from './gate/gate.js';
import { dirSource, gitChangedFiles, gitRefSource, gitRoot, worktreeSource } from './gate/sources.js';
import { DEFAULT_DIRS, lintFiles } from './lint/engine.js';
import { summarize, type Summary } from './report/format.js';

/** Bad input from the caller, as opposed to a failure inside redfirst. */
export class UsageError extends Error {}

export interface Report {
  findings: Finding[];
  summary: Summary;
  failed: boolean;
}

interface Common {
  strict?: boolean;
  configFile?: string;
  framework?: Framework;
}

export interface LintRequest extends Common {
  paths?: string[];
}

export interface GateRequest extends Common {
  base?: string;
  head?: string;
  baseDir?: string;
  headDir?: string;
  mode?: GateMode;
  paths?: string[];
  allowRemoval?: boolean;
  allowProtected?: boolean;
  allowDependencies?: boolean;
}

function report(tool: Summary['tool'], findings: Finding[], strict: boolean | undefined, files: number): Report {
  const failed = findings.some((f) => f.severity === 'error') || (!!strict && findings.length > 0);
  return { findings, summary: summarize(tool, findings, failed, files), failed };
}

export async function lintProject(cwd: string, request: LintRequest = {}): Promise<Report> {
  const config = loadConfig(cwd, request.configFile);
  const paths = request.paths?.length ? request.paths : DEFAULT_DIRS.filter((d) => existsSync(path.join(cwd, d)));
  if (paths.length === 0) throw new UsageError(`No paths given and none of ${DEFAULT_DIRS.join(', ')} exist.`);
  const { files, findings } = await lintFiles(cwd, paths, { config, framework: request.framework });
  if (files.length === 0) throw new UsageError(`No files matched: ${paths.join(' ')}`);
  return report('lint', findings, request.strict, files.length);
}

export function gateProject(cwd: string, request: GateRequest): Report {
  const mode = request.mode ?? 'review';
  if (mode !== 'review' && mode !== 'heal') throw new UsageError(`mode must be review or heal, got ${String(mode)}`);
  const config = loadConfig(cwd, request.configFile);

  let base;
  let head;
  let changed: string[] | undefined;
  if (request.baseDir || request.headDir) {
    if (!request.baseDir || !request.headDir) throw new UsageError('--base-dir and --head-dir go together.');
    base = dirSource(path.resolve(cwd, request.baseDir));
    head = dirSource(path.resolve(cwd, request.headDir));
  } else {
    if (!request.base) throw new UsageError('gate needs --base <ref> (or --base-dir and --head-dir).');
    const root = gitRoot(cwd);
    base = gitRefSource(root, request.base);
    head = request.head ? gitRefSource(root, request.head) : worktreeSource(root);
    changed = gitChangedFiles(root, request.base, request.head);
  }

  const result = runGate({
    base,
    head,
    mode,
    paths: request.paths,
    allowRemoval: request.allowRemoval,
    allowProtected: request.allowProtected,
    allowDependencies: request.allowDependencies,
    config,
    framework: request.framework,
    changed,
  });
  return report('gate', result.findings, request.strict, result.changedFiles.length);
}
