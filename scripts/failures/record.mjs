#!/usr/bin/env node
// Records the failure corpus: runs each case's test against the public ServeRest with the case's faults,
// and keeps what an agent would get to diagnose it (the report, the error context, the API calls).
//
//   node scripts/failures/record.mjs --deps <dir with node_modules/@playwright/test> [--baseline] [case ids...]
//
// --deps is a checkout of playwright-serverest-e2e with its dependencies installed and browsers downloaded.
// The suite copy runs in a temporary .redfirst-recording/ folder inside it, so Node finds those modules
// without links; the folder is removed afterwards. Needs network access to serverest.dev.
// Every case first runs without faults and must pass (unless it is a live failure of the real app), so a
// recorded failure is the case's and not one the app already had. --baseline stops there.
import { spawn } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { startApiProxy, startFrontProxy } from './proxy.mjs';

const CORPUS = path.resolve(import.meta.dirname, '../../fixtures/failures');
const FRONT = 'https://front.serverest.dev';
const API = 'https://serverest.dev';

const { values, positionals } = parseArgs({
  options: { deps: { type: 'string' }, baseline: { type: 'boolean', default: false }, keep: { type: 'boolean', default: false } },
  allowPositionals: true,
});
if (!values.deps) {
  console.error('Usage: record.mjs --deps <playwright-serverest-e2e checkout> [--baseline] [case ids...]');
  process.exit(2);
}
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

/** The target test's last result, with the evidence an agent would read. */
function extract(report, workdir, file, line) {
  const specs = report.suites.flatMap((s) => [...specsOf(s)]);
  const spec = specs.find((s) => s.file.replace(/\\/g, '/').endsWith(file.replace(/^tests\//, '')) && s.line === line);
  if (!spec) throw new Error(`Test ${file}:${line} not found in the report.`);
  const test = spec.tests.at(-1);
  const result = test.results.at(-1);
  const evidence = [];
  let errorContext;
  for (const a of result.attachments ?? []) {
    const body = a.body ? Buffer.from(a.body, 'base64').toString('utf8') : a.path && existsSync(a.path) ? readFileSync(a.path, 'utf8') : undefined;
    if (a.name === 'error-context') errorContext = body;
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
  };
}

/**
 * One run of the case's test. Faulted: the case's file changes are laid over the suite and its proxy faults are
 * armed while the target runs. Not faulted: the plain suite against the real app.
 */
async function execute(id, spec, faulted) {
  const dir = path.join(CORPUS, 'cases', id);
  const [file, lineText] = spec.test.split(':');
  const line = Number(lineText);
  const workdir = path.join(deps, '.redfirst-recording', id);
  rmSync(workdir, { recursive: true, force: true });
  cpSync(path.join(CORPUS, 'suite'), workdir, { recursive: true });
  if (faulted && existsSync(path.join(dir, 'suite'))) cpSync(path.join(dir, 'suite'), workdir, { recursive: true });

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
    const output = await playwright([`${file}:${line}`, '--project', spec.project, '--trace=on'], 'report.json');
    api.arm(false);
    front.arm(false);
    if (ui) await playwright(['--project', 'cleanup'], 'cleanup.json');
    if (!existsSync(reportFile)) throw new Error(`No report. Playwright said:\n${output.slice(-2000)}`);
    const unused = [
      ...api.hits().flatMap((n, i) => (n ? [] : [`api rule ${i}`])),
      ...front.hits().flatMap((n, i) => (n ? [] : [`front replacement ${i}`])),
    ];
    return { result: extract(JSON.parse(readFileSync(reportFile, 'utf8')), workdir, file, line), unused };
  } finally {
    await api.close();
    await front.close();
    if (!values.keep) rmSync(workdir, { recursive: true, force: true });
  }
}

const firstLine = (result) => result.errors[0]?.message.split('\n')[0] ?? '';

async function record(id) {
  const dir = path.join(CORPUS, 'cases', id);
  const spec = JSON.parse(readFileSync(path.join(dir, 'case.json'), 'utf8'));

  // A live case is a failure of the real app, recorded as it is: there is nothing to compare it with.
  if (!spec.live) {
    const baseline = await execute(id, spec, false);
    if (baseline.result.status !== 'passed') throw new Error(`baseline ${baseline.result.status}: ${firstLine(baseline.result)}`);
    if (values.baseline) return `${id}: baseline passed`;
  }

  const { result, unused } = await execute(id, spec, true);
  if (unused.length) throw new Error(`fault never fired: ${unused.join(', ')}`);
  if (result.status === 'passed') throw new Error('the test passed: the fault does not break it');

  const out = path.join(dir, 'recorded');
  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });
  const { errorContext, ...rest } = result;
  writeFileSync(path.join(out, 'result.json'), `${JSON.stringify({ recordedAt: new Date().toISOString().slice(0, 10), ...rest }, null, 2)}\n`);
  if (errorContext) writeFileSync(path.join(out, 'error-context.md'), errorContext);
  return `${id}: recorded (${result.status}) ${firstLine(result)}`;
}

let failed = 0;
for (const id of ids) {
  try {
    console.log(await record(id));
  } catch (error) {
    failed += 1;
    console.log(`${id}: FAILED ${error.message}`);
  }
}
const leftover = path.join(deps, '.redfirst-recording');
if (existsSync(leftover) && statSync(leftover).isDirectory() && readdirSync(leftover).length === 0) rmSync(leftover, { recursive: true });
process.exitCode = failed ? 1 : 0;
