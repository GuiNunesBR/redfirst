import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const CORPUS = path.resolve(import.meta.dirname, '../fixtures/failures');
const CATEGORIES = ['locator', 'timing', 'contract', 'product-bug', 'product-change', 'environment', 'test-bug', 'data'];
const HEAL: Record<string, string> = {
  locator: 'update-test',
  'test-bug': 'update-test',
  data: 'update-test',
  timing: 'do-not-touch',
  contract: 'do-not-touch',
  'product-bug': 'do-not-touch',
  environment: 'do-not-touch',
  'product-change': 'human',
};

interface Case {
  description: string;
  category: string;
  heal: string;
  test: string;
  project: string;
  front?: { find: string; replace: string }[];
  api?: unknown[];
  live?: boolean;
  split: string;
}

const ids = readdirSync(path.join(CORPUS, 'cases')).sort();
const read = (...parts: string[]) => readFileSync(path.join(CORPUS, ...parts), 'utf8');
const caseOf = (id: string) => JSON.parse(read('cases', id, 'case.json')) as Case;

/** Files a case replaces in the suite, relative to the suite root. */
function overlays(id: string): string[] {
  const root = path.join(CORPUS, 'cases', id, 'suite');
  if (!existsSync(root)) return [];
  return readdirSync(root, { recursive: true, withFileTypes: true })
    .filter((e) => e.isFile())
    .map((e) => path.relative(root, path.join(e.parentPath, e.name)).replace(/\\/g, '/'));
}

describe('failure corpus', () => {
  it('covers every category', () => {
    expect(new Set(ids.map((id) => caseOf(id).category))).toEqual(new Set(CATEGORIES));
  });

  it.each(ids)('%s is well formed', (id) => {
    const c = caseOf(id);
    expect(c.description.length).toBeGreaterThan(20);
    expect(CATEGORIES).toContain(c.category);
    expect(c.heal, 'heal follows from the category').toBe(HEAL[c.category]);
    expect(['dev', 'holdout']).toContain(c.split);

    const [file, line] = c.test.split(':');
    const source = existsSync(path.join(CORPUS, 'cases', id, 'suite', file!)) ? read('cases', id, 'suite', file!) : read('suite', file!);
    expect(source.split('\n')[Number(line) - 1], `${c.test} is a test`).toMatch(/^\s+test\(/);
    expect(c.project).toBe(file!.startsWith('tests/api/') ? 'api' : 'chromium');

    const changes = (c.front?.length ?? 0) + (c.api?.length ?? 0) + overlays(id).length;
    if (c.live) expect(changes, 'a live failure is recorded as it is').toBe(0);
    else expect(changes, 'a case changes the app or the test').toBeGreaterThan(0);
  });

  it.each(ids.filter((id) => overlays(id).length))('%s changes one line of the suite', (id) => {
    for (const file of overlays(id)) {
      const before = read('suite', file).split('\n');
      const after = read('cases', id, 'suite', file).split('\n');
      expect(after).toHaveLength(before.length);
      expect(after.filter((line, i) => line !== before[i])).toHaveLength(1);
    }
  });

  it.each(ids)('%s has a recorded failure', (id) => {
    const recorded = JSON.parse(read('cases', id, 'recorded', 'result.json'));
    const c = caseOf(id);
    expect(recorded.status).not.toBe('passed');
    expect(recorded.errors.length).toBeGreaterThan(0);
    expect(`${recorded.test.file}:${recorded.test.line}`).toBe(c.test);
    expect(recorded.test.project).toBe(c.project);
  });

  it.each(ids)('%s leaks no machine paths or tokens', (id) => {
    const dir = path.join(CORPUS, 'cases', id, 'recorded');
    for (const file of readdirSync(dir)) {
      const text = readFileSync(path.join(dir, file), 'utf8');
      expect(text, file).not.toMatch(/[A-Za-z]:[\\/]Users|\/home\/|\/Users\/|\.redfirst-recording/);
      expect(text, file).not.toMatch(/Bearer (?!<token>)[A-Za-z0-9._-]{20,}/);
      expect(text, file).not.toMatch(/\u001b\[/);
    }
  });
});
