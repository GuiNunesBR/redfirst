import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { classify, compare, HEAL_OF, shapeDiff, type Category, type Diagnosis, type FailureInput } from '../src/diagnose/classify.js';
import { endpointOf, shapeOf, type Evidence } from '../src/diagnose/trace.js';

const CORPUS = path.resolve(import.meta.dirname, '../fixtures/failures');
const read = (...parts: string[]) => readFileSync(path.join(CORPUS, ...parts), 'utf8');

interface Case {
  category: Category;
  heal: string;
  split: 'dev' | 'holdout';
  live?: boolean;
}

/** Lines a case's overlay changes in the suite: the test code that changed since the passing run. */
function testChanges(id: string): FailureInput['testChanges'] {
  const root = path.join(CORPUS, 'cases', id, 'suite');
  if (!existsSync(root)) return [];
  return readdirSync(root, { recursive: true, withFileTypes: true })
    .filter((e) => e.isFile())
    .map((e) => path.relative(root, path.join(e.parentPath, e.name)).replace(/\\/g, '/'))
    .map((file) => {
      const before = read('suite', file).split('\n');
      const after = read('cases', id, 'suite', file).split('\n');
      return { file, before: before.filter((l, i) => l !== after[i]), after: after.filter((l, i) => l !== before[i]) };
    });
}

function inputOf(id: string): FailureInput {
  const result = JSON.parse(read('cases', id, 'recorded', 'result.json'));
  const evidence = JSON.parse(read('cases', id, 'recorded', 'evidence.json')) as { passing: Evidence | null; failing: Evidence };
  const context = path.join(CORPUS, 'cases', id, 'recorded', 'error-context.md');
  return {
    test: result.test,
    errors: result.errors,
    failing: evidence.failing,
    passing: evidence.passing,
    testChanges: testChanges(id),
    snapshot: existsSync(context) ? readFileSync(context, 'utf8') : undefined,
  };
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

  it('keeps every category on a heal', () => {
    expect(Object.keys(HEAL_OF)).toHaveLength(9);
  });
});
