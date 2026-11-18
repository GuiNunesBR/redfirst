import type { Call, Evidence, Shape } from './trace.js';

export type Category = 'locator' | 'timing' | 'contract' | 'product-bug' | 'product-change' | 'environment' | 'test-bug' | 'data' | 'unknown';

/** What the agent may do with the failing test. Only `update-test` lets it change the test on its own. */
export type Heal = 'update-test' | 'do-not-touch' | 'human';

export const HEAL_OF: Record<Category, Heal> = {
  locator: 'update-test',
  'test-bug': 'update-test',
  data: 'update-test',
  timing: 'do-not-touch',
  contract: 'do-not-touch',
  'product-bug': 'do-not-touch',
  environment: 'do-not-touch',
  'product-change': 'human',
  unknown: 'human',
};

export interface FailureInput {
  test: { file: string; line: number; title: string };
  errors: { message: string; location?: { file: string; line: number } }[];
  failing: Evidence;
  /** The same test in a run that passed, before the failure. Without it nothing can be compared. */
  passing?: Evidence | null;
  /** Lines of test code (specs, page objects, helpers) changed since that passing run. */
  testChanges?: { file: string; before: string[]; after: string[] }[];
  /** Playwright's ARIA snapshot of the page at the failure, when there is one. */
  snapshot?: string;
}

/** A difference between the passing and the failing run, as evidence. */
export interface Change {
  kind: 'endpoint-replaced' | 'call-missing' | 'status' | 'response-shape' | 'request-shape' | 'slower' | 'no-response' | 'faked' | 'shown' | 'test-code';
  detail: string;
}

export interface Diagnosis {
  test: string;
  failure: { message: string; at?: string; step?: string };
  category: Category;
  confidence: 'high' | 'medium' | 'low';
  heal: Heal;
  reasons: string[];
  changes: Change[];
  mayDo: string[];
  mustNotDo: string[];
  questions: string[];
  unknowns: string[];
  bugReport?: string;
}

const NEVER = [
  'Change an expected value, status or text to what the app returns now.',
  'Raise a timeout or add retries or waits.',
  'Skip, fail-mark, delete or weaken the test or one of its assertions.',
  'Fake the response with route.fulfill or cy.intercept.',
];

const callName = (c: Call) => `${c.method} ${c.endpoint}`;
const firstLine = (text: string | undefined) => (text ?? '').split('\n').find((l) => l.trim()) ?? '';

function shapeText(shape: Shape | undefined): string {
  if (shape === undefined) return 'no body';
  return JSON.stringify(shape).replace(/"/g, '').slice(0, 300);
}

/** Keys added, removed or retyped between two shapes, with dotted paths. Array lengths are data, not shape. */
export function shapeDiff(before: Shape | undefined, after: Shape | undefined, at = ''): string[] {
  if (before === undefined || after === undefined) return before === after ? [] : [`${at || 'body'}: ${shapeText(before)} -> ${shapeText(after)}`];
  if (typeof before === 'string' || typeof after === 'string') return JSON.stringify(before) === JSON.stringify(after) ? [] : [`${at || 'body'}: ${shapeText(before)} -> ${shapeText(after)}`];
  if ('array' in before && 'array' in after && typeof before.array === 'number' && typeof after.array === 'number') {
    return before.of && after.of ? shapeDiff(before.of as Shape, after.of as Shape, `${at}[]`) : [];
  }
  const a = before as Record<string, Shape>;
  const b = after as Record<string, Shape>;
  const out: string[] = [];
  for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
    const path = at ? `${at}.${key}` : key;
    if (!(key in b)) out.push(`${path} removed`);
    else if (!(key in a)) out.push(`${path} added (${shapeText(b[key])})`);
    else out.push(...shapeDiff(a[key], b[key], path));
  }
  return out;
}

const sameShape = (a: Shape | undefined, b: Shape | undefined) => shapeDiff(a, b).length === 0;
const ok = (status: Call['status']) => typeof status === 'number' && status < 400;

/** Compares the page's calls and the test's calls of the two runs, in order, up to where the failing run stopped. */
export function compare(passing: Evidence, failing: Evidence): Change[] {
  const changes: Change[] = [];
  for (const from of ['page', 'test'] as const) {
    const before = passing.calls.filter((c) => c.from === from);
    const after = failing.calls.filter((c) => c.from === from);
    let i = 0;
    let j = 0;
    while (i < before.length && j < after.length) {
      const p = before[i]!;
      const f = after[j]!;
      if (callName(p) === callName(f)) {
        if (f.status === 'no response' && p.status !== 'no response') {
          changes.push({ kind: 'no-response', detail: `${from} ${callName(f)} got no answer before the test ended (passing run: ${p.status} in ${p.ms} ms).` });
        } else if (p.status !== f.status) {
          changes.push({ kind: 'status', detail: `${from} ${callName(f)} answered ${f.status} (passing run: ${p.status}).${f.error ? ` Body: ${f.error}` : ''}` });
        } else if (f.ms !== undefined && p.ms !== undefined && f.ms > 2000 && f.ms > 3 * p.ms) {
          changes.push({ kind: 'slower', detail: `${from} ${callName(f)} took ${f.ms} ms (passing run: ${p.ms} ms).` });
        }
        // An error answer has its own body: with a new status, a new shape is not a contract change.
        if (p.status === f.status) for (const d of shapeDiff(p.response, f.response)) changes.push({ kind: 'response-shape', detail: `${from} ${callName(f)} response: ${d}.` });
        for (const d of shapeDiff(p.request, f.request)) changes.push({ kind: 'request-shape', detail: `${from} ${callName(f)} request: ${d}.` });
        if (f.answeredBy && !p.answeredBy) changes.push({ kind: 'faked', detail: `${from} ${callName(f)} was answered by ${f.answeredBy}.` });
        i += 1;
        j += 1;
        continue;
      }
      // Calls the failing run made that the passing one did not, in the place of one it did make.
      const later = after.findIndex((c, k) => k > j && callName(c) === callName(p));
      if (later < 0 && !before.slice(i + 1).some((c) => callName(c) === callName(f))) {
        const similar = f.method === p.method && ok(f.status) && sameShape(p.response, f.response);
        changes.push({
          kind: 'endpoint-replaced',
          detail:
            `The ${from === 'page' ? 'app' : 'test'} called ${callName(f)} (${f.status}) where the passing run called ${callName(p)} (${p.status})` +
            (similar ? ', and the answer has the same shape.' : `. Response then: ${shapeText(p.response)}; now: ${shapeText(f.response)}.`),
        });
        i += 1;
        j += 1;
      } else if (later >= 0) {
        j += 1;
      } else {
        changes.push({ kind: 'call-missing', detail: `${from} ${callName(p)} was not called (the passing run called it at this point).` });
        i += 1;
      }
    }
  }
  // What the page showed in each assertion on an element, in order, where both runs read the element.
  const onElement = (e: Evidence) => e.actions.filter((a) => a.step.startsWith('Expect') && a.target);
  const before = onElement(passing);
  const after = onElement(failing);
  for (let k = 0; k < Math.min(before.length, after.length); k += 1) {
    const p = before[k]!;
    const f = after[k]!;
    if (p.shown === undefined || f.shown === undefined || p.shown === f.shown) continue;
    changes.push({ kind: 'shown', detail: `The page showed "${f.shown}" in ${f.step} on ${f.target}; in the passing run it showed "${p.shown}".` });
  }
  return changes;
}

const NETWORK_ERROR = /ECONNRESET|ECONNREFUSED|ETIMEDOUT|EAI_AGAIN|ENOTFOUND|socket hang up|net::ERR_/;
const SCHEMA_ERROR = /Invalid input|Invalid string|expected (string|number|boolean|object|array), received|must have required property|should have required property|does not match schema|Contrato inválido/;
const NOT_CALLED = /waitForResponse|waitForRequest|n[ãa]o chamou|was not called|never (called|requested)|No request|cy\.wait\(\) timed out waiting/i;
const NOT_FOUND = /element\(s\) not found|waiting for (getBy|locator|internal:)|Timeout \d+ms exceeded/;
const GATEWAY = new Set([502, 503, 504]);

function expectedReceived(message: string): { expected?: string; received?: string } {
  const expected = /^Expected(?: substring| pattern| string)?: (.*)$/m.exec(message)?.[1]?.trim();
  const received = /^Received(?: string| value)?: (.*)$/m.exec(message)?.[1]?.trim();
  return { expected, received };
}

const words = (value: string) => value.replace(/[\d.,]+/g, '#');

/** A test-code change that writes a fixed value where there was a generated one: shared-environment data. */
const fixedData = (changes: FailureInput['testChanges']) =>
  (changes ?? []).some((c) => c.after.some((line) => /['"`][^'"`]*(@|\d{3,})[^'"`]*['"`]/.test(line) && !c.before.some((b) => b.includes(line.trim()))));

export function classify(input: FailureInput): Diagnosis {
  const message = input.errors.map((e) => e.message).join('\n');
  const where = input.errors[0]?.location;
  const failedStep = input.failing.actions.find((a) => a.error);
  const changes = input.passing ? compare(input.passing, input.failing) : [];
  const testCode = (input.testChanges ?? []).filter((c) => c.before.length || c.after.length);
  for (const c of testCode) {
    changes.push({ kind: 'test-code', detail: `${c.file}: ${[...c.before.map((l) => `- ${l.trim()}`), ...c.after.map((l) => `+ ${l.trim()}`)].join(' ')}` });
  }
  const of = (...kinds: Change['kind'][]) => changes.filter((c) => kinds.includes(c.kind));
  const failingCalls = input.failing.calls;
  const gateway = failingCalls.find((c) => typeof c.status === 'number' && (GATEWAY.has(c.status) || (c.status >= 500 && c.response !== undefined && typeof c.response === 'string')));
  const { expected, received } = expectedReceived(message);
  const rejectedByApp = failingCalls.find((c) => c.from === 'page' && typeof c.status === 'number' && c.status >= 400 && c.status < 500);

  const reasons: string[] = [];
  const questions: string[] = [];
  const unknowns: string[] = [];
  let category: Category = 'unknown';
  let confidence: Diagnosis['confidence'] = 'low';
  const mayDo: string[] = [];

  if (NETWORK_ERROR.test(message)) {
    category = 'environment';
    confidence = 'high';
    reasons.push(`The connection failed: ${firstLine(NETWORK_ERROR.exec(message)?.input.split('\n').find((l) => NETWORK_ERROR.test(l)))}`);
  } else if (gateway) {
    category = 'environment';
    confidence = 'high';
    reasons.push(`${gateway.from === 'page' ? 'The app' : 'The test'} got ${gateway.status} from ${callName(gateway)}: an outage or a gateway, not an answer of the app.`);
  } else if (testCode.length && !of('endpoint-replaced', 'response-shape', 'faked').length) {
    category = fixedData(testCode) ? 'data' : 'test-bug';
    confidence = 'medium';
    reasons.push('The test code changed since the run that passed, and the app answered the same way it did then except where the changed test sent something else.');
    mayDo.push('Fix or revert the changed test line so it sends what the test means to send.');
    questions.push('Was the change to the test intended? If it was, what should it send instead?');
  } else if (SCHEMA_ERROR.test(message)) {
    category = 'contract';
    confidence = 'high';
    reasons.push(`A response failed the schema the test validates: ${firstLine(message.split('\n').find((l) => SCHEMA_ERROR.test(l) && !/^Error: Contrato/.test(l)) ?? message)}`);
    questions.push('Did the API change its contract on purpose? If so, the schema changes in a reviewed change of its own, not in a repair.');
  } else if (of('endpoint-replaced').some((c) => c.detail.startsWith('The app'))) {
    category = 'product-change';
    confidence = of('endpoint-replaced').some((c) => c.detail.endsWith('same shape.')) ? 'high' : 'medium';
    reasons.push('The app reached the same point through a different endpoint than in the passing run.');
    questions.push('Is the new endpoint intended? Then the test should follow it, after a human says so.');
    questions.push('Or did the app call the wrong endpoint? Then it is a bug to report and the test stays as it is.');
  } else if (of('no-response', 'slower').length) {
    category = 'timing';
    confidence = 'high';
    reasons.push('A call the test depends on answered much later than in the passing run, or not before the test gave up.');
    questions.push('Is the slowness a regression of the app or the environment? A test timeout must not grow to hide it.');
  } else if (rejectedByApp && (!input.passing || of('status').length) && (/\b(200|201|204)\b/.test(expected ?? '') || NOT_FOUND.test(message))) {
    category = 'product-bug';
    confidence = 'medium';
    reasons.push(`The app sent ${callName(rejectedByApp)} and its own API rejected it with ${rejectedByApp.status}${rejectedByApp.error ? `: ${rejectedByApp.error}` : ''}.`);
    if (rejectedByApp.request) reasons.push(`What the app sent: ${shapeText(rejectedByApp.request)}.`);
  } else if (of('status').length && expected !== undefined) {
    category = 'product-bug';
    confidence = 'medium';
    reasons.push(`The app answered with another status than in the passing run, and the test expected ${expected}.`);
  } else if (failedStep && !/^Expect/.test(failedStep.step) && (NOT_FOUND.test(message) || NOT_CALLED.test(message) || failedStep.error === 'never finished')) {
    category = 'locator';
    confidence = input.passing ? 'medium' : 'low';
    reasons.push(`The step "${failedStep.step}" on ${failedStep.target ?? 'its element'} could not find its element, and the app's calls up to there match the passing run.`);
    mayDo.push(`Change the locator of "${failedStep.step}" to one that finds the same control (role and name, label or test id). Leave every assertion as it is.`);
    questions.push('Is it the same control under a new name, or did the control go away? If it went away, it is not a locator problem.');
  } else if (expected !== undefined && received !== undefined) {
    const sameWords = words(expected) === words(received);
    category = sameWords || /^\d+$/.test(expected) ? 'product-bug' : 'product-change';
    confidence = 'low';
    reasons.push(`The test expected ${expected} and got ${received}${sameWords ? ': the same text with other numbers' : ''}.`);
    if (category === 'product-change') questions.push(`Is "${received}" the intended new behaviour, or a bug? Only a human can say; the test keeps expecting ${expected} until then.`);
  } else if (/^Expect/.test(failedStep?.step ?? '') && NOT_FOUND.test(message)) {
    const byText = /has-text|name=|internal:text|getByText/.test(failedStep?.target ?? message);
    category = byText ? 'product-change' : 'unknown';
    confidence = 'low';
    reasons.push(`The assertion "${failedStep?.step}" did not find ${failedStep?.target ?? 'its element'} while the app's calls match the passing run: the page shows something else.`);
    questions.push('Did the page content change on purpose, or is it a bug? Compare the page snapshot below with what the test expects.');
  } else if (NOT_CALLED.test(message)) {
    reasons.push('The call the test waits for did not happen, and nothing in the evidence explains why.');
  }

  if (!input.passing) unknowns.push('No passing run to compare with: changes in endpoints, statuses and answers since the test last passed cannot be shown.');
  if (category === 'unknown') unknowns.push('The evidence does not point to one cause.');
  if (!input.snapshot) unknowns.push('No page snapshot at the failure.');
  if (input.passing && !input.passing.actions.some((a) => a.shown !== undefined)) unknowns.push('The passing run has no page text for its assertions: only its calls and steps are compared.');

  const heal = HEAL_OF[category];
  if (heal !== 'update-test') mayDo.length = 0;
  if (heal === 'do-not-touch') mayDo.push('Report it with the evidence below and leave the test failing.');
  if (heal === 'human') mayDo.push('Ask the questions below and wait for the answer.');

  const diagnosis: Diagnosis = {
    test: `${input.test.file}:${input.test.line} ${input.test.title}`,
    failure: {
      message: firstLine(message),
      at: where ? `${where.file}:${where.line}` : undefined,
      step: failedStep ? `${failedStep.step}${failedStep.target ? ` on ${failedStep.target}` : ''}` : undefined,
    },
    category,
    confidence,
    heal,
    reasons,
    changes,
    mayDo,
    mustNotDo: NEVER,
    questions,
    unknowns,
  };
  if (heal === 'do-not-touch' && category !== 'environment') diagnosis.bugReport = bugReport(input, diagnosis);
  return diagnosis;
}

function bugReport(input: FailureInput, d: Diagnosis): string {
  const steps = input.failing.actions.map((a, i) => `${i + 1}. ${a.step}${a.target ? ` (${a.target})` : ''}${a.error ? ` - failed: ${a.error}` : ''}`);
  const calls = input.failing.calls.map(
    (c) => `- ${c.from} ${callName(c)} -> ${c.status}${c.ms !== undefined ? ` in ${c.ms} ms` : ''}${c.request ? `; sent ${shapeText(c.request)}` : ''}${c.error ? `; answer: ${c.error}` : ''}`,
  );
  return [
    `## ${d.failure.message.replace(/^Error: /, '')}`,
    '',
    `Found by the automated test ${d.test}.`,
    '',
    '### Steps',
    ...steps,
    '',
    '### Expected and actual',
    d.failure.message,
    ...d.reasons.map((r) => `- ${r}`),
    '',
    '### Calls',
    ...calls,
    ...(d.changes.length ? ['', '### Since the last passing run', ...d.changes.map((c) => `- ${c.detail}`)] : []),
  ].join('\n');
}
