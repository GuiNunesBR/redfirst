#!/usr/bin/env node
// Records the failure corpus: runs each case's test against the public ServeRest with the case's faults,
// and keeps what an agent would get to diagnose it (the report, the error context, the API calls), plus the
// evidence from the trace of a passing and of the failing run: what the page and the test sent and got back.
//
//   node scripts/failures/record.mjs --deps <dir with node_modules/@playwright/test> [--baseline] [case ids...]
//   node scripts/failures/record.mjs --deps <dir> --repairs [case ids...]
//
// --deps is a checkout of playwright-serverest-e2e with its dependencies installed and browsers downloaded.
// The suite copy runs in a temporary .redfirst-recording/ folder inside it, so Node finds those modules
// without links; the folder is removed afterwards. Needs network access to serverest.dev.
// Every case first runs without faults and must pass (unless it is a live failure of the real app), so a
// recorded failure is the case's and not one the app already had. --baseline stops there.
// --repairs runs each repair attempt of the cases three times against the app with the case's faults, and keeps
// the statuses and the evidence of a green run: what `redfirst verify` checks after a repair.
import { spawn } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { startApiProxy, startFrontProxy } from './proxy.mjs';

const CORPUS = path.resolve(import.meta.dirname, '../../fixtures/failures');
// The same trace reader the diagnosis uses; run `npm run build` first.
const TRACE = path.resolve(import.meta.dirname, '../../dist/diagnose/trace.js');
const FRONT = 'https://front.serverest.dev';
const API = 'https://serverest.dev';

const { values, positionals } = parseArgs({
  options: { deps: { type: 'string' }, baseline: { type: 'boolean', default: false }, repairs: { type: 'boolean', default: false }, keep: { type: 'boolean', default: false } },
  allowPositionals: true,
});
if (!values.deps) {
  console.error('Usage: record.mjs --deps <playwright-serverest-e2e checkout> [--baseline] [case ids...]');
  process.exit(2);
}
if (!existsSync(TRACE)) {
  console.error('Run npm run build first: the recorder reads traces with dist/diagnose/trace.js.');
  process.exit(2);
}
const { evidenceOf } = await import(pathToFileURL(TRACE).href);
const deps = path.resolve(values.deps);
const cli = path.join(deps, 'node_modules', '@playwright', 'test', 'cli.js');
if (!existsSync(cli)) {
  console.error(`No @playwright/test in ${deps}/node_modules.`);
  process.exit(2);
}

/** Async on purpose: the proxies live in this process and must keep answering while Playwright runs. */
function run(args, options) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, args, options);
    let output = '';
    child.stdout.on('data', (d) => (output += d));
    child.stderr.on('data', (d) => (output += d));
    const timer = setTimeout(() => child.kill(), 300_000);
    child.on('close', () => {
      clearTimeout(timer);
      resolve(output);
    });
  });
}

const ids = positionals.length ? positionals : readdirSync(path.join(CORPUS, 'cases')).sort();

/**
 * Error messages carry ANSI colours, absolute temp paths and Windows separators in stack lines, and the
 * evidence carries tokens of the throwaway users. None of that belongs in the corpus.
 */
function clean(text, workdir) {
  return (text ?? '')
    .replace(/\u001b\[[0-9;]*m/g, '')
    .split(workdir + path.sep)
    .join('')
    .split(workdir.replace(/\\/g, '/') + '/')
    .join('')
    .replace(/^\s*(at |- Location: |- Name: ).*$/gm, (line) => line.replace(/\\/g, '/'))
    .replace(/Bearer [A-Za-z0-9._-]+/g, 'Bearer <token>');
}

/** The parts of Playwright's error context about this failure; the test source is in the suite copy. */
function errorContextOf(text) {
  const start = text.indexOf('# Test info');
  const end = text.indexOf('# Test source');
  return `${text.slice(start < 0 ? 0 : start, end < 0 ? undefined : end).trimEnd()}\n`;
}

function* specsOf(suite) {
  for (const spec of suite.specs ?? []) yield spec;
  for (const child of suite.suites ?? []) yield* specsOf(child);
}

/** The target test in a report: by file and line, or by title when a repair moved it. */
function specOf(report, file, line, title) {
  const specs = (report.suites ?? []).flatMap((s) => [...specsOf(s)]);
  const inFile = specs.filter((s) => s.file.replace(/\\/g, '/').endsWith(file.replace(/^tests\//, '')));
  return inFile.find((s) => s.line === line) ?? (title ? inFile.find((s) => s.title === title) : undefined);
}

/** The target test's last result, with the evidence an agent would read. */
function extract(report, workdir, file, line) {
  const spec = specOf(report, file, line);
  if (!spec) throw new Error(`Test ${file}:${line} not found in the report.`);
  const test = spec.tests.at(-1);
  const result = test.results.at(-1);
  const evidence = [];
  let errorContext;
  let trace;
  for (const a of result.attachments ?? []) {
    const body = a.body ? Buffer.from(a.body, 'base64').toString('utf8') : a.path && existsSync(a.path) ? readFileSync(a.path, 'utf8') : undefined;
    if (a.name === 'trace') trace = a.path;
    else if (a.name === 'error-context') errorContext = body;
    else if (a.contentType === 'application/json' && body) evidence.push({ name: a.name, body: JSON.parse(clean(body, workdir)) });
  }
  return {
    test: { file, line, title: spec.title, project: test.projectName },
    status: result.status,
    durationMs: result.duration,
    errors: (result.errors ?? []).map((e) => ({
      message: clean(e.message, workdir),
      location: e.location
        ? { file: clean(e.location.file, workdir).replace(/\\/g, '/'), line: e.location.line, column: e.location.column }
        : undefined,
      snippet: clean(e.snippet, workdir) || undefined,
    })),
    apiCalls: evidence,
    errorContext: errorContext && errorContextOf(clean(errorContext, workdir)),
    trace,
  };
}

/**
 * One run of the case's test. Faulted: the case's file changes are laid over the suite and its proxy faults are
 * armed while the target runs. Not faulted: the plain suite against the real app.
 */
async function execute(id, spec, faulted, repair) {
  const dir = path.join(CORPUS, 'cases', id);
  const [file, lineText] = spec.test.split(':');
  const line = Number(lineText);
  const workdir = path.join(deps, '.redfirst-recording', id);
  rmSync(workdir, { recursive: true, force: true });
  cpSync(path.join(CORPUS, 'suite'), workdir, { recursive: true });
  if (faulted && existsSync(path.join(dir, 'suite'))) cpSync(path.join(dir, 'suite'), workdir, { recursive: true });
  if (repair) cpSync(path.join(dir, 'repairs', repair.name, 'files'), workdir, { recursive: true });

  const api = await startApiProxy(API, spec.api ?? []);
  const front = await startFrontProxy(FRONT, API, api.url, spec.front ?? []);
  const reportFile = path.join(workdir, 'report.json');
  try {
    const { CI: _ci, ...base } = process.env;
    const env = { ...base, FRONT_URL: front.url, API_URL: api.url };
    // Each phase gets its own output folder: a later run would wipe the target's error context.
    const playwright = (args, json) =>
      run([cli, 'test', ...args, '--no-deps', '--retries=0', '--workers=1', '--reporter=json', `--output=results-${path.parse(json).name}`], {
        cwd: workdir,
        env: { ...env, PLAYWRIGHT_JSON_OUTPUT_NAME: path.join(workdir, json) },
      });
    // UI tests need the admin session from the setup project; it runs, and cleans up, against the real app.
    const ui = spec.project !== 'api';
    if (ui) await playwright(['--project', 'setup'], 'setup.json');
    api.arm(faulted);
    front.arm(faulted);
    // A repair may move the test: run it by title, three times.
    const literal = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const target = repair ? [file, '--grep', literal(repair.title), '--repeat-each=3'] : [`${file}:${line}`];
    const output = await playwright([...target, '--project', spec.project, '--trace=on'], 'report.json');
    api.arm(false);
    front.arm(false);
    if (ui) await playwright(['--project', 'cleanup'], 'cleanup.json');
    if (!existsSync(reportFile)) throw new Error(`No report. Playwright said:\n${output.slice(-2000)}`);
    const unused = [
      ...api.hits().flatMap((n, i) => (n ? [] : [`api rule ${i}`])),
      ...front.hits().flatMap((n, i) => (n ? [] : [`front replacement ${i}`])),
    ];
    if (repair) return { runs: repairRuns(JSON.parse(readFileSync(reportFile, 'utf8')), workdir, file, line, repair.title, api.url), unused };
    const { trace, ...result } = extract(JSON.parse(readFileSync(reportFile, 'utf8')), workdir, file, line);
    if (!trace) throw new Error('No trace in the report.');
    const evidence = JSON.parse(clean(JSON.stringify(evidenceOf(trace, { origin: api.url })), workdir));
    return { result, evidence, unused };
  } finally {
    await api.close();
    await front.close();
    if (!values.keep) rmSync(workdir, { recursive: true, force: true });
  }
}

/** Every run of the target test in a --repeat-each report, and the evidence of the first green one. */
function repairRuns(report, workdir, file, line, title, origin) {
  const spec = specOf(report, file, line, title);
  if (!spec) return { statuses: [], errors: ['The test is no longer in the file.'], evidence: null };
  const results = spec.tests.flatMap((t) => t.results.slice(-1));
  const green = results.find((r) => r.status === 'passed');
  const trace = green?.attachments?.find((a) => a.name === 'trace')?.path;
  const evidence = trace ? JSON.parse(clean(JSON.stringify(evidenceOf(trace, { origin })), workdir)) : null;
  const errors = [...new Set(results.flatMap((r) => (r.errors ?? []).map((e) => clean(e.message, workdir).split('\n')[0])))];
  return { statuses: results.map((r) => r.status), errors, evidence };
}

/** Each repair attempt of a case, run three times against the app with the case's faults. */
async function recordRepairs(id) {
  const dir = path.join(CORPUS, 'cases', id);
  const spec = JSON.parse(readFileSync(path.join(dir, 'case.json'), 'utf8'));
  const repairs = path.join(dir, 'repairs');
  if (!existsSync(repairs)) return `${id}: no repairs`;
  const { title } = JSON.parse(readFileSync(path.join(dir, 'recorded', 'result.json'), 'utf8')).test;
  const lines = [];
  for (const name of readdirSync(repairs).sort()) {
    const { runs, unused } = await execute(id, spec, true, { name, title });
    const out = path.join(repairs, name, 'recorded');
    rmSync(out, { recursive: true, force: true });
    mkdirSync(out, { recursive: true });
    // A fault the repair never reached is information, not an error: a faked answer, for one, avoids the app.
    const record = { recordedAt: new Date().toISOString().slice(0, 10), ...runs, faultsNotReached: unused };
    writeFileSync(path.join(out, 'run.json'), `${JSON.stringify(record, null, 2)}\n`);
    lines.push(`${id}/${name}: ${runs.statuses.join(' ') || 'not run'}${unused.length ? ` (faults not reached: ${unused.join(', ')})` : ''}`);
  }
  return lines.join('\n');
}

const firstLine = (result) => result.errors[0]?.message.split('\n')[0] ?? '';

async function record(id) {
  const dir = path.join(CORPUS, 'cases', id);
  const spec = JSON.parse(readFileSync(path.join(dir, 'case.json'), 'utf8'));

  // A live case is a failure of the real app, recorded as it is: there is nothing to compare it with.
  let passing;
  if (!spec.live) {
    const baseline = await execute(id, spec, false);
    if (baseline.result.status !== 'passed') throw new Error(`baseline ${baseline.result.status}: ${firstLine(baseline.result)}`);
    if (values.baseline) return `${id}: baseline passed`;
    passing = baseline.evidence;
  }

  const { result, evidence, unused } = await execute(id, spec, true);
  if (unused.length) throw new Error(`fault never fired: ${unused.join(', ')}`);
  if (result.status === 'passed') throw new Error('the test passed: the fault does not break it');

  const out = path.join(dir, 'recorded');
  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });
  const { errorContext, ...rest } = result;
  writeFileSync(path.join(out, 'result.json'), `${JSON.stringify({ recordedAt: new Date().toISOString().slice(0, 10), ...rest }, null, 2)}\n`);
  if (errorContext) writeFileSync(path.join(out, 'error-context.md'), errorContext);
  // A live case has no passing run to compare with: the real app fails it.
  writeFileSync(path.join(out, 'evidence.json'), `${JSON.stringify({ passing: passing ?? null, failing: evidence }, null, 2)}
`);
  return `${id}: recorded (${result.status}) ${firstLine(result)}`;
}

let failed = 0;
for (const id of ids) {
  try {
    console.log(await (values.repairs ? recordRepairs(id) : record(id)));
  } catch (error) {
    failed += 1;
    console.log(`${id}: FAILED ${error.message}`);
  }
}
const leftover = path.join(deps, '.redfirst-recording');
if (existsSync(leftover) && statSync(leftover).isDirectory() && readdirSync(leftover).length === 0) rmSync(leftover, { recursive: true });
process.exitCode = failed ? 1 : 0;
