/**
 * Files an agent must not change on its own: whoever can edit them can switch the checks off.
 * Same list as the pre-edit hook (hooks/pre-edit-protect.mjs).
 */
export const PROTECTED_PATHS: RegExp[] = [
  /(^|\/)playwright\.config\.[cm]?[jt]s$/,
  /(^|\/)cypress\.config\.[cm]?[jt]s$/,
  /(^|\/)(vitest|jest)\.config\.[cm]?[jt]s$/,
  /(^|\/)\.redfirstrc\.json$/,
  /(^|\/)eslint\.config\.[cm]?[jt]s$/,
  /(^|\/)\.eslintrc(\.[a-z]+)?$/,
  /(^|\/)tsconfig[^/]*\.json$/,
  /^\.github\/workflows\//,
  /(^|\/)CODEOWNERS$/,
  /^\.claude\/(settings[^/]*\.json|hooks\/)/,
  /^\.codex\/(config\.toml|hooks\.json|hooks\/)/,
  /^\.grok\/hooks\//,
  /(^|\/)(post-edit-lint|pre-edit-protect|edited-files)\.m?js$/,
];

export const isProtected = (file: string) => PROTECTED_PATHS.some((re) => re.test(file));

/**
 * Contracts the tests validate against (Zod/JSON schemas). Loosening one makes every test that uses it pass a
 * broken response. Not in the edit hook: writing a new test often means adding a schema.
 */
export const CONTRACT_PATHS: RegExp[] = [/(^|\/)(schemas?|contracts?)(\.[cm]?[jt]s$|\/)/, /\.(schema|contract)\.[cm]?[jt]s$/];

const numbers = (expression: string) => (expression.match(/\d[\d_]*/g) ?? []).map((n) => Number(n.replace(/_/g, '')));
const maxOf = (values: number[]) => (values.length ? Math.max(...values) : 0);

function settingMax(text: string, key: string): number {
  const re = new RegExp(`\\b${key}\\s*:\\s*([^,}\\n]+)`, 'g');
  return maxOf([...text.matchAll(re)].flatMap((m) => numbers(m[1] ?? '')));
}

/** Lines that compare values (`toEqual({ timeout: 2 })`): a `timeout` there is data the test expects, not a wait. */
const VALUE_ASSERTION = /\.(toEqual|toStrictEqual|toMatchObject|toContainEqual|toHaveProperty)\(/;
const withoutValueAssertions = (text: string) => text.split(/\r?\n/).filter((l) => !VALUE_ASSERTION.test(l)).join('\n');

/** Waits and retries raised inside test code: `{ timeout: 15_000 }`, `configure({ retries })`, `test.setTimeout`, `test.slow()`. */
export function waitSignals(baseText: string, headText: string): string[] {
  const base = withoutValueAssertions(baseText);
  const head = withoutValueAssertions(headText);
  const signals: string[] = [];
  if (settingMax(head, 'retries') > settingMax(base, 'retries')) signals.push('retries increased');
  for (const key of ['timeout', 'defaultCommandTimeout', 'requestTimeout', 'responseTimeout']) {
    if (settingMax(head, key) > settingMax(base, key)) signals.push(`${key} increased`);
  }
  const setTimeoutMax = (text: string) => maxOf([...text.matchAll(/\b(?:test|it)\.setTimeout\(\s*([\d_]+)/g)].flatMap((m) => numbers(m[1] ?? '')));
  if (setTimeoutMax(head) > setTimeoutMax(base)) signals.push('test.setTimeout increased');
  if (count(head, /\btest\.slow\(/g) > count(base, /\btest\.slow\(/g)) signals.push('test.slow() added');
  return signals;
}

const count = (text: string, re: RegExp) => (text.match(re) ?? []).length;

const TIMEOUT_KEYS = ['timeout', 'defaultCommandTimeout', 'pageLoadTimeout', 'requestTimeout', 'responseTimeout', 'testTimeout', 'globalTimeout'];
const FILTER_KEYS = /\b(testIgnore|grepInvert|grep|excludeSpecPattern|testPathIgnorePatterns)\b/g;

/** Specific reasons a protected change matters, beyond "it changed". */
export function protectedSignals(file: string, base: string, head: string): string[] {
  const signals: string[] = [];
  if (/\.[cm]?[jt]s$/.test(file) || file.endsWith('.json')) {
    if (settingMax(head, 'retries') > settingMax(base, 'retries')) signals.push('retries increased');
    for (const key of TIMEOUT_KEYS) {
      if (settingMax(head, key) > settingMax(base, key)) signals.push(`${key} increased`);
    }
    if (/forbidOnly/.test(base) && (!/forbidOnly/.test(head) || /forbidOnly\s*:\s*false/.test(head))) signals.push('forbidOnly removed');
    if (count(head, FILTER_KEYS) > count(base, FILTER_KEYS)) signals.push('new test filter (testIgnore/grep/grepInvert)');
    if (/\.redfirstrc\.json$/.test(file) && count(head, /"off"/g) > count(base, /"off"/g)) signals.push('a rule was turned off');
  }
  if (/\.ya?ml$/.test(file)) {
    const steps = /^\s*-\s+(run|uses|name)\s*:/gm;
    if (count(head, steps) < count(base, steps)) signals.push('a workflow step was removed');
    if (count(head, /continue-on-error\s*:\s*true/g) > count(base, /continue-on-error\s*:\s*true/g)) signals.push('continue-on-error added');
    if (count(head, /\|\|\s*(true|exit 0)/g) > count(base, /\|\|\s*(true|exit 0)/g)) signals.push('a command now ignores its failure');
  }
  return signals;
}

const DEPENDENCY_FIELDS = ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'];
const LOCKFILES = /(^|\/)(package-lock\.json|npm-shrinkwrap\.json|yarn\.lock|pnpm-lock\.yaml|bun\.lockb?)$/;
export const isLockfile = (file: string) => LOCKFILES.test(file);

/** Added or changed dependencies, and script changes, between two package.json texts. */
export function packageChanges(base: string | undefined, head: string | undefined): { dependencies: string[]; scripts: string[] } {
  const parse = (text: string | undefined): Record<string, Record<string, string> | undefined> => {
    try {
      return text ? JSON.parse(text) : {};
    } catch {
      return {};
    }
  };
  const before = parse(base);
  const after = parse(head);
  const dependencies: string[] = [];
  for (const field of DEPENDENCY_FIELDS) {
    for (const [name, version] of Object.entries(after[field] ?? {})) {
      const previous = before[field]?.[name];
      if (previous === undefined) dependencies.push(`${name}@${version} (new)`);
      else if (previous !== version) dependencies.push(`${name} ${previous} -> ${version}`);
    }
  }
  const scripts: string[] = [];
  const beforeScripts = before.scripts ?? {};
  const afterScripts = after.scripts ?? {};
  for (const name of new Set([...Object.keys(beforeScripts), ...Object.keys(afterScripts)])) {
    if (beforeScripts[name] !== afterScripts[name]) scripts.push(name);
  }
  return { dependencies, scripts };
}

/** Patterns that silence a check. A new occurrence on a changed file is G009. */
export const DISABLE_PATTERNS: { label: string; re: RegExp }[] = [
  { label: 'redfirst-disable', re: /redfirst-disable/g },
  { label: 'eslint-disable', re: /eslint-disable/g },
  { label: '@ts-ignore', re: /@ts-ignore/g },
  { label: '@ts-expect-error', re: /@ts-expect-error/g },
  { label: '@ts-nocheck', re: /@ts-nocheck/g },
  { label: 'skip/fixme/fail', re: /\b(test|it|describe|context)\.(skip|fixme|fail)\s*\(|\b(xit|xdescribe|xcontext)\s*\(/g },
];
