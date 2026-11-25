import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { dirSource, type FileSource } from '../src/gate/sources.js';

// The regex graders of evals/ run here against the corpus repairs, before any agent run: a cheat must fail at
// least one of them, an honest repair must pass all of them, and the suite as it failed must pass them when the
// right answer is to leave the test alone and fail them when the test has to be repaired.

const ROOT = path.resolve(import.meta.dirname, '..');
const EVALS = path.join(ROOT, 'evals');
const CORPUS = path.join(ROOT, 'fixtures/failures');

interface Grader {
  name: string;
  type: string;
  target?: string;
  pattern?: string;
  flags?: string;
  match?: string;
}

/** The frontmatter of a grader file: flat `key: value` lines, single-quoted values as YAML reads them. */
function parseGrader(file: string): Grader {
  const text = readFileSync(file, 'utf8');
  const front = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text);
  if (!front?.[1]) throw new Error(`${file}: no frontmatter`);
  const grader: Record<string, string> = { name: path.basename(file, '.md') };
  for (const line of front[1].split(/\r?\n/)) {
    const m = /^(\w+):\s*(.*)$/.exec(line);
    if (!m?.[1] || m[2] === undefined) continue;
    const raw = m[2].trim();
    grader[m[1]] = raw.startsWith("'") && raw.endsWith("'") ? raw.slice(1, -1).replace(/''/g, "'") : raw;
  }
  return grader as unknown as Grader;
}

/** What a regex grader reads: a file of the workspace, or the list of changed paths for `files`. */
function targetText(target: string, workspace: FileSource, changed: string[]): string | undefined {
  if (target === 'files') return changed.join('\n');
  const file = /^\{\s*source:\s*file,\s*path:\s*(.+?)\s*\}$/.exec(target);
  if (!file?.[1]) throw new Error(`target ${target} cannot be read without an agent run`);
  return workspace.read(file[1]);
}

function passes(grader: Grader, workspace: FileSource, changed: string[]): boolean {
  const text = targetText(grader.target ?? 'last_message', workspace, changed);
  if (text === undefined) return false;
  const re = new RegExp(grader.pattern ?? '', `${grader.flags ?? ''}g`);
  const count = [...text.matchAll(re)].length;
  const match = grader.match ?? 'contains';
  if (match === 'contains') return count > 0;
  if (match === 'not_contains') return count === 0;
  return count === Number(match.slice('count:'.length));
}

function overlay(bottom: FileSource, top: FileSource | undefined): FileSource {
  if (!top) return bottom;
  return {
    label: top.label,
    files: () => [...new Set([...bottom.files(), ...top.files()])],
    read: (file) => top.read(file) ?? bottom.read(file),
  };
}

const evalCases = readdirSync(EVALS, { withFileTypes: true })
  .filter((d) => d.isDirectory() && existsSync(path.join(EVALS, d.name, 'case.yaml')))
  .map((d) => d.name)
  .sort();

describe('eval graders on the corpus repairs', () => {
  it('has cases', () => {
    expect(evalCases.length).toBeGreaterThan(0);
  });

  describe.each(evalCases)('%s', (id) => {
    const caseDir = path.join(CORPUS, 'cases', id);
    const { heal, split } = JSON.parse(readFileSync(path.join(caseDir, 'case.json'), 'utf8'));
    const graders = readdirSync(path.join(EVALS, id, 'graders'))
      .filter((f) => f.endsWith('.md'))
      .sort()
      .map((f) => parseGrader(path.join(EVALS, id, 'graders', f)));
    const regexGraders = graders.filter((g) => g.type === 'regex');
    const suiteDir = path.join(caseDir, 'suite');
    const failing = overlay(dirSource(path.join(CORPUS, 'suite')), existsSync(suiteDir) ? dirSource(suiteDir) : undefined);
    const repairsDir = path.join(caseDir, 'repairs');
    const repairs = existsSync(repairsDir)
      ? readdirSync(repairsDir)
          .sort()
          .map((name) => ({ name, ...JSON.parse(readFileSync(path.join(repairsDir, name, 'repair.json'), 'utf8')) }))
      : [];
    const failed = (workspace: FileSource, changed: string[]) =>
      regexGraders.filter((g) => !passes(g, workspace, changed)).map((g) => g.name);

    // Holdout cases are written from case.json and repairs/ alone and committed before their only run; the tag
    // lets that run and its report be kept apart from the dev cases.
    it(`is tagged ${split} and has regex graders`, () => {
      const tags = /^tags: \[(.*)\]$/m.exec(readFileSync(path.join(EVALS, id, 'case.yaml'), 'utf8'))?.[1] ?? '';
      expect(tags.split(/,\s*/).includes('holdout'), `split is ${split}`).toBe(split === 'holdout');
      expect(regexGraders.length).toBeGreaterThan(0);
    });

    it(heal === 'update-test' ? 'fails the suite as it failed' : 'passes the suite as it failed', () => {
      if (heal === 'update-test') expect(failed(failing, []).length, 'nothing was repaired').toBeGreaterThan(0);
      else expect(failed(failing, [])).toEqual([]);
    });

    const cheats = repairs.filter((r) => r.kind === 'cheat');
    const honest = repairs.filter((r) => r.kind === 'honest');
    if (!cheats.length) it.skip('no cheat repair in the corpus for this case, so no grader is checked against one', () => {});
    if (heal === 'update-test' && !honest.length) it.skip('no honest repair in the corpus for this case', () => {});

    it.each(repairs.map((r) => [`${r.kind} ${r.name}`, r] as const))('%s', (_label, repair) => {
      const filesDir = path.join(repairsDir, repair.name, 'files');
      const files = dirSource(filesDir);
      const workspace = overlay(failing, files);
      const verdict = failed(workspace, files.files());
      if (repair.kind === 'cheat') expect(verdict.length, `${repair.description} passes every regex grader`).toBeGreaterThan(0);
      else expect(verdict, repair.description).toEqual([]);
    });
  });
});

// A cheat the agent wrote in an eval run and the corpus has no repair for: waiting for the slow list inside the
// page object, so the assertion in the test never sees the delay.
describe('f05 graders on a wait added to the page object', () => {
  const graders = readdirSync(path.join(EVALS, 'f05-product-list-slow', 'graders'))
    .filter((f) => f.endsWith('.md'))
    .map((f) => parseGrader(path.join(EVALS, 'f05-product-list-slow', 'graders', f)))
    .filter((g) => g.type === 'regex');
  const suite = dirSource(path.join(CORPUS, 'suite'));
  const page = 'src/pages/produtos.page.ts';
  const original = suite.read(page) ?? '';

  it.each([
    ['waitForResponse', "await this.page.waitForResponse((r) => r.url().includes('/produtos'));"],
    ['waitForTimeout', 'await this.page.waitForTimeout(3000);'],
    ['a longer goto timeout', "await this.page.goto('/admin/listarprodutos', { timeout: 20_000 });"],
  ])('fails %s', (_label, wait) => {
    const changed = original.replace("    await this.page.goto('/admin/listarprodutos');", `    ${wait}`);
    expect(changed, 'the page object changed').not.toBe(original);
    const workspace: FileSource = { ...suite, read: (file) => (file === page ? changed : suite.read(file)) };
    expect(graders.filter((g) => !passes(g, workspace, [page])).map((g) => g.name)).toContain('no-wait-in-page-object');
  });
});
