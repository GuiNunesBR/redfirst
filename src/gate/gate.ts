import type { Config } from '../config.js';
import type { Finding, Framework, Severity } from '../core/types.js';
import { lintText, sortFindings } from '../lint/engine.js';
import { DISABLE_PATTERNS, isLockfile, isProtected, packageChanges, protectedSignals } from './protected.js';
import { alignAssertions, snapshotFile, type TestSnapshot } from './snapshot.js';
import type { FileSource } from './sources.js';

export type GateMode = 'review' | 'heal';

export interface GateOptions {
  base: FileSource;
  head: FileSource;
  mode?: GateMode;
  /** Restrict test files to these globs (default: test-like file names and test folders). */
  paths?: string[];
  allowRemoval?: boolean;
  /** Human overrides for G007 and G008, after review. Never meant for agents. */
  allowProtected?: boolean;
  allowDependencies?: boolean;
  config?: Config;
  framework?: Framework;
}

export interface GateResult {
  findings: Finding[];
  failed: boolean;
  changedFiles: string[];
}

const SOURCE_FILE = /\.[cm]?[jt]sx?$/;
const TEST_NAME = /\.(spec|test|cy)\.[cm]?[jt]sx?$/;
const TEST_DIR = /(^|\/)(tests?|e2e|__tests__|cypress\/e2e)\//;

export function isTestFile(file: string): boolean {
  return TEST_NAME.test(file) || (TEST_DIR.test(file) && SOURCE_FILE.test(file));
}

/** Minimal glob: `**`, `*`, `?` and `{a,b}`. */
export function globToRegExp(glob: string): RegExp {
  let re = '';
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i]!;
    if (c === '*' && glob[i + 1] === '*') {
      re += glob[i + 2] === '/' ? '(?:.*/)?' : '.*';
      i += glob[i + 2] === '/' ? 2 : 1;
    } else if (c === '*') re += '[^/]*';
    else if (c === '?') re += '[^/]';
    else if (c === '{') {
      const end = glob.indexOf('}', i);
      re += `(?:${glob.slice(i + 1, end).split(',').map((s) => s.replace(/[.+^$()|[\]\\]/g, '\\$&')).join('|')})`;
      i = end;
    } else re += c.replace(/[.+^$()|[\]\\]/g, '\\$&');
  }
  return new RegExp(`^${re}$`);
}

function lineOf(text: string | undefined, needle: RegExp): number {
  if (!text) return 1;
  const index = text.split(/\r?\n/).findIndex((l) => needle.test(l));
  return index >= 0 ? index + 1 : 1;
}

export function runGate(options: GateOptions): GateResult {
  const mode = options.mode ?? 'review';
  const { base, head } = options;
  const findings: Finding[] = [];
  const add = (rule: string, severity: Severity, file: string, line: number, message: string, test?: string) =>
    findings.push({ rule, severity, file, line, column: 1, message, test });

  const all = [...new Set([...base.files(), ...head.files()])].sort();
  const changed = all.filter((f) => base.read(f) !== head.read(f));
  const filters = options.paths?.map(globToRegExp);
  const inScope = (f: string) => (filters ? filters.some((re) => re.test(f)) : isTestFile(f));

  // G001-G005: test-by-test comparison of changed test files.
  for (const file of changed.filter((f) => SOURCE_FILE.test(f) && inScope(f))) {
    const before = base.read(file);
    const after = head.read(file);
    const baseTests = before === undefined ? new Map<string, TestSnapshot>() : snapshotFile(file, before, options.framework);
    const headTests = after === undefined ? new Map<string, TestSnapshot>() : snapshotFile(file, after, options.framework);

    for (const [title, was] of baseTests) {
      const now = headTests.get(title);
      if (!now) {
        if (!options.allowRemoval) {
          const hint = after === undefined ? 'its file was deleted' : 'renamed tests show up as removed + added';
          add('G001', 'error', file, was.line, `Test was removed (${hint}).`, title);
        }
        continue;
      }
      const always = (list: TestSnapshot['assertions']) => list.filter((a) => !a.conditional).length;
      if (now.assertions.length < was.assertions.length) {
        add('G002', 'error', file, now.line, `Assertions went from ${was.assertions.length} to ${now.assertions.length}.`, title);
      } else if (always(now.assertions) < always(was.assertions)) {
        add('G002', 'error', file, now.line, `Assertions that always run went from ${always(was.assertions)} to ${always(now.assertions)}; the rest are now behind a condition.`, title);
      }
      const strongBefore = was.assertions.filter((a) => a.strength === 'strong');
      const strongAfter = now.assertions.filter((a) => a.strength === 'strong');
      // Removals are G002; G003 is about strong checks that turned weak.
      const removed = Math.max(0, was.assertions.length - now.assertions.length);
      if (strongBefore.length - strongAfter.length > removed) {
        const lost = strongBefore.map((a) => a.matcher).filter((m) => !strongAfter.some((s) => s.matcher === m));
        const weak = now.assertions.filter((a) => a.strength === 'weak').map((a) => a.matcher);
        const detail = lost.length ? `${lost.join(', ')} is gone` : 'fewer value checks';
        add('G003', 'error', file, now.line, `Strong assertions went from ${strongBefore.length} to ${strongAfter.length} (${detail}${weak.length ? `; presence-only now: ${weak.join(', ')}` : ''}).`, title);
      }
      for (const flag of ['skip', 'fixme', 'only'] as const) {
        if (now[flag] && !was[flag]) add('G004', 'error', file, now.line, `Test gained .${flag}.`, title);
      }
      for (const [i, j] of alignAssertions(was.assertions, now.assertions)) {
        const a = was.assertions[i]!;
        const b = now.assertions[j]!;
        if (a.expected !== null && b.expected !== null && a.expected !== b.expected) {
          add('G005', mode === 'heal' ? 'error' : 'warn', file, b.line, `Expected value of ${b.matcher} changed: ${a.expected} -> ${b.expected}. Needs a human decision.`, title);
        }
      }
    }
  }

  // G006: lint findings that are new in changed source files (pre-existing debt is ignored).
  for (const file of changed.filter((f) => SOURCE_FILE.test(f) && (inScope(f) || isTestFile(f)))) {
    const after = head.read(file);
    if (after === undefined) continue;
    const before = base.read(file);
    const key = (f: Finding, text: string) => `${f.rule}|${(text.split(/\r?\n/)[f.line - 1] ?? '').trim()}`;
    const lintOptions = { config: options.config, framework: options.framework };
    const previous = new Map<string, number>();
    if (before !== undefined) {
      for (const f of lintText(file, before, lintOptions)) previous.set(key(f, before), (previous.get(key(f, before)) ?? 0) + 1);
    }
    for (const f of lintText(file, after, lintOptions)) {
      const k = key(f, after);
      const left = previous.get(k) ?? 0;
      if (left > 0) {
        previous.set(k, left - 1);
        continue;
      }
      add('G006', f.severity, file, f.line, `New ${f.rule}: ${f.message}`, f.test);
    }
  }

  // G007: protected files.
  for (const file of changed.filter(isProtected)) {
    if (options.allowProtected) continue;
    const signals = protectedSignals(file, base.read(file) ?? '', head.read(file) ?? '');
    const state = head.read(file) === undefined ? 'deleted' : base.read(file) === undefined ? 'added' : 'changed';
    add('G007', 'error', file, 1, `Protected file ${state}${signals.length ? `: ${signals.join('; ')}` : ''}. A human must make or approve this change.`);
  }

  // G007 (scripts) and G008 (dependencies) from package.json.
  for (const file of changed.filter((f) => /(^|\/)package\.json$/.test(f))) {
    const { dependencies, scripts } = packageChanges(base.read(file), head.read(file));
    if (scripts.length && !options.allowProtected) {
      add('G007', 'error', file, lineOf(head.read(file), /"scripts"/), `npm scripts changed: ${scripts.join(', ')}. A human must make or approve this change.`);
    }
    if (dependencies.length && !options.allowDependencies) {
      add('G008', 'error', file, lineOf(head.read(file), /ependencies"/), `Dependencies added or changed: ${dependencies.join(', ')}. A human must check that each package exists and is the intended one.`);
    }
  }
  const packageChanged = changed.some((f) => /(^|\/)package\.json$/.test(f) && packageChanges(base.read(f), head.read(f)).dependencies.length);
  for (const file of changed.filter(isLockfile)) {
    if (!packageChanged && !options.allowDependencies) add('G008', 'error', file, 1, 'Lockfile changed without a reviewed package.json change.');
  }

  // G009: new disable comments or skips on changed files.
  for (const file of changed.filter((f) => SOURCE_FILE.test(f))) {
    const before = base.read(file) ?? '';
    const after = head.read(file);
    if (after === undefined) continue;
    for (const { label, re } of DISABLE_PATTERNS) {
      const added = (after.match(re) ?? []).length - (before.match(re) ?? []).length;
      if (added > 0) {
        const old = new Set(before.split(/\r?\n/).map((l) => l.trim()));
        const index = after.split(/\r?\n/).findIndex((l) => new RegExp(re.source).test(l) && !old.has(l.trim()));
        const line = index >= 0 ? index + 1 : lineOf(after, new RegExp(re.source));
        add('G009', 'error', file, line, `${added} new ${label}${added > 1 ? ' occurrences' : ''}. Silencing a check needs a human.`);
      }
    }
  }

  const sorted = sortFindings(findings);
  return { findings: sorted, failed: sorted.some((f) => f.severity === 'error'), changedFiles: changed };
}
