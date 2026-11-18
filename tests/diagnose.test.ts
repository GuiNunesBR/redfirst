import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { classify, compare, HEAL_OF, shapeDiff, type Category, type Diagnosis } from '../src/diagnose/classify.js';
import { endpointOf, evidenceOf, maskData, shapeOf, type Evidence } from '../src/diagnose/trace.js';
import { inputOf } from './support/failures.js';
import { writeRun } from './support/trace.js';

const CORPUS = path.resolve(import.meta.dirname, '../fixtures/failures');
const read = (...parts: string[]) => readFileSync(path.join(CORPUS, ...parts), 'utf8');

interface Case {
  category: Category;
  heal: string;
  split: 'dev' | 'holdout';
  live?: boolean;
}

const ids = readdirSync(path.join(CORPUS, 'cases'))
  .sort()
  .filter((id) => existsSync(path.join(CORPUS, 'cases', id, 'recorded', 'evidence.json')));
const results: { id: string; split: string; expected: Case; got: Diagnosis }[] = [];

describe('diagnosis on the failure corpus', () => {
  it.each(ids)('%s', (id) => {
    const expected = JSON.parse(read('cases', id, 'case.json')) as Case;
    const got = classify(inputOf(id));
    results.push({ id, split: expected.split, expected, got });
    // The one mistake that turns a bug into a green build: the app is at fault and the agent is told to fix the test.
    if (expected.heal !== 'update-test') expect(got.heal, `${id}: ${got.reasons.join(' ')}`).not.toBe('update-test');
    expect(got.mustNotDo.length).toBeGreaterThan(0);
    if (got.heal !== 'update-test') expect(got.mayDo.join(' ')).not.toMatch(/locator|revert/i);
  });

  afterAll(() => {
    for (const split of ['dev', 'holdout']) {
      const rows = results.filter((r) => r.split === split);
      if (!rows.length) continue;
      const category = rows.filter((r) => r.got.category === r.expected.category).length;
      const heal = rows.filter((r) => r.got.heal === r.expected.heal).length;
      const critical = rows.filter((r) => r.expected.heal !== 'update-test' && r.got.heal === 'update-test').length;
      console.log(`diagnosis ${split}: category ${category}/${rows.length}, action ${heal}/${rows.length}, app failure told to update the test ${critical}`);
      // Misses are listed for dev only: rules are tuned on dev, and holdout stays a count.
      for (const r of rows.filter((r) => split === 'dev' && r.got.category !== r.expected.category)) {
        console.log(`  ${r.id}: expected ${r.expected.category}, got ${r.got.category} (${r.got.confidence})`);
      }
    }
  });
});

describe('diagnosis parts', () => {
  const call = (endpoint: string, response: unknown, status = 200) => ({ from: 'page' as const, method: 'GET', endpoint, status, ms: 100, response: shapeOf(response) });
  const run = (...calls: ReturnType<typeof call>[]): Evidence => ({ calls, actions: [] });

  it('reads ids and query values out of endpoints', () => {
    expect(endpointOf('http://x/usuarios/iwoziXFKCRIgnBMG?email=a%40b')).toBe('/usuarios/:id?email=');
    expect(endpointOf('http://x/orders/42/items')).toBe('/orders/:id/items');
    expect(endpointOf('http://x/carrinhos/concluir-compra')).toBe('/carrinhos/concluir-compra');
  });

  it('diffs shapes by key and type, not by data', () => {
    expect(shapeDiff(shapeOf({ _id: 'a', n: 1 }), shapeOf({ id: 'a', n: '1' }))).toEqual(['_id removed', 'n: number -> string', 'id added (string)']);
    expect(shapeDiff(shapeOf({ list: [{ a: 1 }] }), shapeOf({ list: [{ a: 2 }, { a: 3 }] }))).toEqual([]);
  });

  it('sees an endpoint replaced by another with the same answer', () => {
    const changes = compare(run(call('/users', { users: [{ id: 'x' }] })), run(call('/v2/people', { users: [{ id: 'y' }] })));
    expect(changes).toEqual([{ kind: 'endpoint-replaced', detail: expect.stringContaining('the same shape') }]);
  });

  it('does not count calls cut off by the failure as missing', () => {
    expect(compare(run(call('/a', {}), call('/b', {})), run(call('/a', {})))).toEqual([]);
  });

  it('asks a human about a replaced endpoint and never tells the agent to update the test', () => {
    const d = classify({
      test: { file: 't.spec.ts', line: 1, title: 'lists users' },
      errors: [{ message: 'Error: page.waitForResponse: Timeout 5000ms exceeded' }],
      passing: run(call('/users', { users: [{ id: 'x' }] })),
      failing: run(call('/v2/people', { users: [{ id: 'y' }] })),
    });
    expect(d).toMatchObject({ category: 'product-change', heal: 'human', confidence: 'high' });
    expect(d.questions.join(' ')).toMatch(/wrong endpoint/);
  });

  it('reads the text of an asserted element through the snapshots it refers to', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'redfirst-shown-'));
    try {
      writeRun(path.join(dir, 'a'), '/users');
      writeRun(path.join(dir, 'b'), '/users', { shows: 'Ana (inactive)' });
      const before = evidenceOf(path.join(dir, 'a', 'trace.zip'));
      const after = evidenceOf(path.join(dir, 'b', 'trace.zip'));
      expect(before.actions.find((a) => a.step.startsWith('Expect'))?.shown).toBe('Ana');
      expect(compare(before, after)).toEqual([{ kind: 'shown', detail: expect.stringContaining('"Ana (inactive)"') }]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("reads page text without the run's own data", () => {
    const data = new Map([
      ['Produto mwjjhwu9lyo5', 'nome'],
      ['123', 'preco'],
    ]);
    expect(maskData('  Produto mwjjhwu9lyo5\n Preço R$123 ', data)).toBe('‹nome› Preço R$‹preco›');
    expect(maskData('Preço R$246 · Total: 2', data)).toBe('Preço R$# · Total: 2');
    expect(maskData('id 5f8aB3dE5gH7jK9m', data)).toBe('id ‹id›');
  });

  it('keeps every category on a heal', () => {
    expect(Object.keys(HEAL_OF)).toHaveLength(9);
  });
});
