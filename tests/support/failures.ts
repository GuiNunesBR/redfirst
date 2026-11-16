import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import type { FailureInput } from '../../src/diagnose/classify.js';
import type { Evidence } from '../../src/diagnose/trace.js';

const CORPUS = path.resolve(import.meta.dirname, '../../fixtures/failures');
const read = (...parts: string[]) => readFileSync(path.join(CORPUS, ...parts), 'utf8');

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

/** What `diagnose` gets for a corpus case: its recorded failure, evidence and test changes. */
export function inputOf(id: string): FailureInput {
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
