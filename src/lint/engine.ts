import { readFileSync } from 'node:fs';
import path from 'node:path';
import { glob } from 'tinyglobby';
import { analyze } from '../core/analyze.js';
import { position } from '../core/source.js';
import type { Finding, Framework } from '../core/types.js';
import type { Config } from '../config.js';
import { DISABLE_WITHOUT_REASON, RULES } from './registry.js';

export interface LintOptions {
  config?: Config;
  framework?: Framework;
}

const DISABLE = /redfirst-disable-next-line\b(.*)$/;
const DISABLE_BODY = /^\s+([A-Z]{2}\d{3}(?:\s*,\s*[A-Z]{2}\d{3})*)\s*(?:--\s*(\S.*?))?\s*(?:\*\/)?\s*$/;

interface Disables {
  /** Line (1-based) -> rules disabled on it. */
  byLine: Map<number, Set<string>>;
  invalid: Finding[];
}

function readDisables(file: string, text: string): Disables {
  const byLine = new Map<number, Set<string>>();
  const invalid: Finding[] = [];
  text.split(/\r?\n/).forEach((lineText, index) => {
    const match = DISABLE.exec(lineText);
    if (!match) return;
    const body = DISABLE_BODY.exec(match[1] ?? '');
    if (!body || !body[2]) {
      invalid.push({
        rule: DISABLE_WITHOUT_REASON.id,
        severity: 'error',
        file,
        line: index + 1,
        column: (match.index ?? 0) + 1,
        message: 'redfirst-disable-next-line needs rule ids and a reason: "TL007 -- why". It was not applied.',
      });
      return;
    }
    byLine.set(index + 2, new Set(body[1]!.split(',').map((r) => r.trim())));
  });
  return { byLine, invalid };
}

/** Lints one file's text. Used by the CLI and by the gate on both sides of a change. */
export function lintText(file: string, text: string, options: LintOptions = {}): Finding[] {
  const settings = options.config?.rules ?? {};
  const analysis = analyze(file, text, options.framework ?? options.config?.framework);
  const findings: Finding[] = [];

  for (const rule of RULES) {
    const setting = settings[rule.id] ?? rule.severity;
    if (setting === 'off') continue;
    if (rule.applies !== 'both' && rule.applies !== analysis.framework) continue;
    rule.check({
      analysis,
      report(node, message, test) {
        findings.push({
          rule: rule.id,
          severity: setting,
          file,
          ...position(analysis.sf, node),
          message,
          test: test?.fullTitle,
        });
      },
    });
  }

  const disables = readDisables(file, text);
  const kept = findings.filter((f) => !disables.byLine.get(f.line)?.has(f.rule));
  const disableSetting = settings[DISABLE_WITHOUT_REASON.id] ?? 'error';
  const invalid = disableSetting === 'off' ? [] : disables.invalid.map((f) => ({ ...f, severity: disableSetting }));
  return sortFindings([...kept, ...invalid]);
}

export function sortFindings(findings: Finding[]): Finding[] {
  return findings.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line || a.column - b.column || a.rule.localeCompare(b.rule));
}

export const SOURCE_EXTENSIONS = '{ts,tsx,mts,cts,js,jsx,mjs,cjs}';
export const DEFAULT_DIRS = ['tests', 'cypress', 'e2e'];
const ALWAYS_IGNORED = ['**/node_modules/**', '**/dist/**', '**/.git/**'];

/** Files to lint: explicit files as given, directories expanded, minus excludes. */
export async function resolveFiles(cwd: string, paths: string[], config?: Config): Promise<string[]> {
  const patterns: string[] = [];
  for (const p of paths) {
    const normalized = p.replace(/\\/g, '/').replace(/\/$/, '');
    patterns.push(/\.[cm]?[jt]sx?$/.test(normalized) || /[*{]/.test(normalized) ? normalized : `${normalized}/**/*.${SOURCE_EXTENSIONS}`);
  }
  const files = await glob([...patterns, ...(config?.include ?? [])], {
    cwd,
    ignore: [...ALWAYS_IGNORED, ...(config?.exclude ?? [])],
    dot: false,
  });
  return files.sort();
}

export async function lintFiles(cwd: string, paths: string[], options: LintOptions = {}): Promise<{ files: string[]; findings: Finding[] }> {
  const files = await resolveFiles(cwd, paths, options.config);
  const findings = files.flatMap((file) => lintText(file, readFileSync(path.join(cwd, file), 'utf8'), options));
  return { files, findings: sortFindings(findings) };
}
