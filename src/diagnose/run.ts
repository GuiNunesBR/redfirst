import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { classify, type Diagnosis, type FailureInput } from './classify.js';
import { evidenceOf, type Evidence } from './trace.js';

export interface DiagnoseRequest {
  /** Playwright JSON report of the failing run (`--reporter=json`), with traces (`--trace=on` or `retain-on-failure`). */
  report: string;
  /** JSON report of an earlier run where the tests passed, with traces (`--trace=on`). */
  passing?: string;
  /** Git ref of the passing run: test code changed since then is part of the evidence. */
  base?: string;
}

interface Attachment {
  name: string;
  path?: string;
  body?: string;
}
interface Result {
  status: string;
  errors?: { message?: string; location?: { file: string; line: number } }[];
  attachments?: Attachment[];
}
interface Spec {
  title: string;
  file: string;
  line: number;
  tests: { projectName: string; results: Result[] }[];
}
interface Suite {
  specs?: Spec[];
  suites?: Suite[];
}

function* specsOf(suite: Suite): Generator<Spec> {
  for (const spec of suite.specs ?? []) yield spec;
  for (const child of suite.suites ?? []) yield* specsOf(child);
}

interface Run {
  spec: Spec;
  project: string;
  result: Result;
  dir: string;
}

function runsOf(file: string): Run[] {
  if (!existsSync(file)) throw new Error(`${file} does not exist.`);
  const report = JSON.parse(readFileSync(file, 'utf8')) as { suites?: Suite[] };
  const dir = path.dirname(file);
  return (report.suites ?? []).flatMap((s) => [...specsOf(s)]).flatMap((spec) => spec.tests.map((t) => ({ spec, project: t.projectName, result: t.results.at(-1)!, dir })).filter((r) => r.result));
}

function attachment(run: Run, name: string): string | undefined {
  const a = run.result.attachments?.find((x) => x.name === name);
  if (!a) return undefined;
  if (a.body) return Buffer.from(a.body, 'base64').toString('utf8');
  if (!a.path) return undefined;
  const file = path.resolve(run.dir, a.path);
  return existsSync(file) ? file : undefined;
}

function evidence(run: Run): Evidence | undefined {
  const trace = attachment(run, 'trace');
  return trace ? evidenceOf(trace) : undefined;
}

const key = (run: Run) => `${run.project} ${run.spec.file} ${run.spec.title}`;
const plain = (text: string) => text.replace(/\u001b\[[0-9;]*m/g, '');

/** Changed lines per test file since `base`, from `git diff -U0`. */
function testChanges(cwd: string, base: string): FailureInput['testChanges'] {
  if (base.startsWith('-')) throw new Error(`Unknown git ref: ${base}`);
  const diff = execFileSync('git', ['diff', '-U0', '--no-color', base, '--', '.'], { cwd, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const changes: NonNullable<FailureInput['testChanges']> = [];
  let current: (typeof changes)[number] | undefined;
  for (const line of diff.split('\n')) {
    const file = /^\+\+\+ b\/(.*)$/.exec(line)?.[1];
    if (file) {
      current = /\.(spec|test|cy)\.[cm]?[jt]sx?$|(^|\/)(tests?|e2e|cypress|pages?|fixtures|helpers|support)\//.test(file) ? { file, before: [], after: [] } : undefined;
      if (current) changes.push(current);
    } else if (current && line.startsWith('-') && !line.startsWith('---')) current.before.push(line.slice(1));
    else if (current && line.startsWith('+') && !line.startsWith('+++')) current.after.push(line.slice(1));
  }
  return changes;
}

/** A diagnosis for every test that failed in the report. */
export function diagnoseProject(cwd: string, request: DiagnoseRequest): Diagnosis[] {
  const failed = runsOf(path.resolve(cwd, request.report)).filter((r) => !['passed', 'skipped'].includes(r.result.status));
  const passed = new Map(request.passing ? runsOf(path.resolve(cwd, request.passing)).filter((r) => r.result.status === 'passed').map((r) => [key(r), r]) : []);
  const changes = request.base ? testChanges(cwd, request.base) : [];
  return failed.map((run) => {
    const reference = passed.get(key(run));
    const failing = evidence(run);
    const context = attachment(run, 'error-context');
    const snapshot = context && existsSync(context) ? readFileSync(context, 'utf8') : context;
    const diagnosis = classify({
      test: { file: run.spec.file, line: run.spec.line, title: run.spec.title },
      errors: (run.result.errors ?? []).map((e) => ({ message: plain(e.message ?? ''), location: e.location })),
      failing: failing ?? { calls: [], actions: [] },
      passing: reference ? evidence(reference) : null,
      testChanges: changes,
      snapshot,
    });
    if (!failing) diagnosis.unknowns.unshift('No trace for this failure: run with --trace=retain-on-failure (or on) to get the calls and steps.');
    if (reference && !evidence(reference)) diagnosis.unknowns.unshift('The passing run has no trace: run it with --trace=on.');
    return diagnosis;
  });
}

/** Plain text for a person or an agent. */
export function formatDiagnosis(d: Diagnosis): string {
  const list = (title: string, items: string[]) => (items.length ? [`  ${title}:`, ...items.map((i) => `    - ${i}`)] : []);
  return [
    `${d.test}`,
    `  failed: ${d.failure.message}${d.failure.at ? ` at ${d.failure.at}` : ''}`,
    ...(d.failure.step ? [`  step: ${d.failure.step}`] : []),
    `  diagnosis: ${d.category} (${d.confidence} confidence); action: ${d.heal}`,
    ...list('why', d.reasons),
    ...list('changed since the passing run', d.changes.map((c) => c.detail)),
    ...list('you may', d.mayDo),
    ...list('you must not', d.mustNotDo),
    ...list('questions for a human', d.questions),
    ...list('cannot tell', d.unknowns),
    ...(d.bugReport ? ['  bug report draft:', ...d.bugReport.split('\n').map((l) => `    ${l}`)] : []),
  ].join('\n');
}
