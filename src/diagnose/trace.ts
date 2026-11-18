import { readFileSync } from 'node:fs';
import { inflateRawSync } from 'node:zlib';

/** Structure of a JSON value without its data: keys and types; arrays as their length and first item. */
export type Shape = string | { array: number; of?: Shape } | { [key: string]: Shape };

export interface Call {
  /** `page` when the app made it, `test` when the test's request context did. */
  from: 'page' | 'test';
  method: string;
  /** Path with ids as `:id` and query values dropped: `/usuarios/:id`, `/produtos?nome=`. */
  endpoint: string;
  status: number | 'no response';
  ms?: number;
  request?: Shape;
  response?: Shape;
  /** Body of a 4xx/5xx answer: the app's own explanation. */
  error?: string;
  /** Set when the test's route answered the page instead of the app. */
  answeredBy?: string;
}

export interface Action {
  step: string;
  /** Playwright's selector for the step, when it has one. */
  target?: string;
  ms?: number;
  error?: string;
  /**
   * For an assertion on an element: the element's text when the assertion ended, with the run's own data as
   * `‹key›` (a value the test or the page sent under that key) and other numbers as `#`.
   */
  shown?: string;
}

/** What one run of a test did: the calls to the app and the test's steps, in order. */
export interface Evidence {
  calls: Call[];
  actions: Action[];
}

/** Entries of a zip file, by name. Enough for the traces Playwright writes (stored or deflated, no zip64). */
export function unzip(file: string): Map<string, Buffer> {
  const data = readFileSync(file);
  let end = data.length - 22;
  while (end >= 0 && data.readUInt32LE(end) !== 0x06054b50) end -= 1;
  if (end < 0) throw new Error(`${file} is not a zip file.`);
  const entries = new Map<string, Buffer>();
  let at = data.readUInt32LE(end + 16);
  for (let i = data.readUInt16LE(end + 10); i > 0; i -= 1) {
    const method = data.readUInt16LE(at + 10);
    const size = data.readUInt32LE(at + 20);
    const nameLength = data.readUInt16LE(at + 28);
    const name = data.toString('utf8', at + 46, at + 46 + nameLength);
    const local = data.readUInt32LE(at + 42);
    const start = local + 30 + data.readUInt16LE(local + 26) + data.readUInt16LE(local + 28);
    const raw = data.subarray(start, start + size);
    entries.set(name, method === 0 ? raw : inflateRawSync(raw));
    at += 46 + nameLength + data.readUInt16LE(at + 30) + data.readUInt16LE(at + 32);
  }
  return entries;
}

// The trace format is internal to Playwright and undocumented. Only the fields below are read, and a trace
// without them fails loudly instead of turning into empty evidence.
interface TraceEvent {
  type: string;
  callId?: string;
  parentId?: string;
  method?: string;
  title?: string;
  startTime?: number;
  endTime?: number;
  params?: { selector?: string; value?: string };
  error?: { message?: string };
  snapshot?: ResourceSnapshot | FrameSnapshot;
}

interface ResourceSnapshot {
    pageref?: string;
    startedDateTime: string;
    time: number;
    _resourceType?: string;
    _wasFulfilled?: boolean;
    request: { method: string; url: string; headers?: { name: string }[]; postData?: { _file?: string; mimeType?: string } };
    response: { status: number; content?: { _file?: string; mimeType?: string } };
}

/**
 * The DOM of a frame after a call. A node is a text, `[tag, attributes?, ...children]`, or `[[snapshotsAgo, index]]`:
 * a subtree unchanged since an earlier snapshot of the same frame, by its index in that snapshot's nodes in post-order.
 */
type DomNode = string | [string] | [string, Record<string, string>, ...DomNode[]] | [[number, number]];
interface FrameSnapshot {
  callId: string;
  phase?: string;
  frameId: string;
  html: DomNode;
}

const lines = (buffer: Buffer | undefined): TraceEvent[] =>
  (buffer?.toString('utf8') ?? '')
    .split('\n')
    .filter(Boolean)
    .map((l) => JSON.parse(l) as TraceEvent);

export function shapeOf(value: unknown, depth = 0): Shape {
  if (value === null) return 'null';
  if (Array.isArray(value)) return value.length ? { array: value.length, of: depth > 4 ? '…' : shapeOf(value[0], depth + 1) } : { array: 0 };
  if (typeof value === 'object') {
    if (depth > 4) return 'object';
    const record = value as Record<string, unknown>;
    return Object.fromEntries(Object.keys(record).sort().map((k) => [k, shapeOf(record[k], depth + 1)]));
  }
  return typeof value;
}

/** `/usuarios/iwoziXFKCRIgnBMG?email=a@b` becomes `/usuarios/:id?email=`: the endpoint, not the data. */
export function endpointOf(url: string): string {
  const { pathname, searchParams } = new URL(url);
  const route = pathname
    .split('/')
    .map((s) => (/^\d+$/.test(s) || /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(s) || (/^[A-Za-z0-9]{16,}$/.test(s) && /[A-Z0-9]/.test(s)) ? ':id' : s))
    .join('/');
  const keys = [...new Set(searchParams.keys())].sort();
  return keys.length ? `${route}?${keys.map((k) => `${k}=`).join('&')}` : route;
}

function bodyOf(entries: Map<string, Buffer>, file: string | undefined, mimeType: string | undefined): Shape | undefined {
  const buffer = file ? entries.get(file) : undefined;
  if (!buffer?.length) return undefined;
  try {
    return shapeOf(JSON.parse(buffer.toString('utf8')));
  } catch {
    return `${mimeType ?? 'text'}, ${buffer.length} bytes`;
  }
}

const isJson = (buffer: Buffer | undefined): unknown => {
  try {
    return buffer?.length ? JSON.parse(buffer.toString('utf8')) : undefined;
  } catch {
    return undefined;
  }
};

/** Values of a JSON body by key: the data a run made up, to tell it apart from what the page shows. */
function valuesOf(value: unknown, into: Map<string, string>, key = 'value'): void {
  if (Array.isArray(value)) for (const item of value) valuesOf(item, into, key);
  else if (value && typeof value === 'object') for (const [k, v] of Object.entries(value)) valuesOf(v, into, k);
  else if ((typeof value === 'string' && value.length >= 3 && !/^(true|false|null)$/.test(value)) || (typeof value === 'number' && Math.abs(value) >= 10)) {
    if (!into.has(String(value))) into.set(String(value), key);
  }
}

/**
 * The text as it reads without the run's data: the same page in another run, with other unique names and
 * prices, reads the same. Single digits stay, so a count like "Total: 2" is still compared.
 */
export function maskData(text: string, data: Map<string, string>): string {
  let out = text.replace(/\s+/g, ' ').trim();
  for (const [value, key] of [...data].sort((a, b) => b[0].length - a[0].length)) {
    out = /^-?\d+(\.\d+)?$/.test(value)
      ? out.replace(new RegExp(`(?<![\\d.,])${value.replace('.', '\\.')}(?![.,]?\\d)`, 'g'), `‹${key}›`)
      : out.split(value).join(`‹${key}›`);
  }
  return out
    .replace(/\b(?=[A-Za-z0-9]*[A-Z0-9])[A-Za-z0-9]{16,}\b/g, '‹id›')
    .replace(/(?<![\d.,])\d{2,}(?:[.,]\d+)*(?![.,]?\d)/g, '#')
    .slice(0, 200);
}

const isRef = (n: DomNode): n is [[number, number]] => Array.isArray(n) && Array.isArray(n[0]);

/** The text of the elements an assertion targeted, from its after-snapshot. */
function targetText(snapshots: FrameSnapshot[], index: number): string | undefined {
  const nodes = new Map<number, DomNode[]>();
  const nodesOf = (i: number) => {
    let list = nodes.get(i);
    if (!list) {
      const out: DomNode[] = [];
      const visit = (n: DomNode) => {
        if (typeof n === 'string') out.push(n);
        else if (!isRef(n)) {
          for (const child of n.slice(2) as DomNode[]) visit(child);
          out.push(n);
        }
      };
      visit(snapshots[i]!.html);
      nodes.set(i, (list = out));
    }
    return list;
  };
  const resolve = (n: DomNode, i: number): [DomNode | undefined, number] => (isRef(n) ? [nodesOf(i - n[0][0])[n[0][1]], i - n[0][0]] : [n, i]);
  const text = (node: DomNode, at: number): string => {
    const [n, i] = resolve(node, at);
    if (n === undefined || isRef(n)) return '';
    if (typeof n === 'string') return n;
    const [tag, attributes, ...children] = n;
    if (/^(SCRIPT|STYLE|NOSCRIPT)$/.test(tag)) return '';
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(tag)) return attributes?.__playwright_value_ ?? '';
    return (children as DomNode[]).map((c) => text(c, i)).join('');
  };
  const found: string[] = [];
  const find = (node: DomNode, at: number) => {
    const [n, i] = resolve(node, at);
    if (n === undefined || typeof n === 'string' || isRef(n)) return;
    if (n[1] && '__playwright_target__' in n[1]) found.push(text(n, i));
    else for (const child of n.slice(2) as DomNode[]) find(child, i);
  };
  find(snapshots[index]!.html, index);
  return found.length ? found.join(' | ') : undefined;
}

function textOf(entries: Map<string, Buffer>, file: string | undefined): string | undefined {
  const text = file ? entries.get(file)?.toString('utf8') : undefined;
  if (!text) return undefined;
  try {
    return JSON.stringify(JSON.parse(text)).slice(0, 500);
  } catch {
    return text.slice(0, 500);
  }
}

const plain = (text: string | undefined) => text?.replace(/\u001b\[[0-9;]*m/g, '');

/** Steps an agent reads in the trace viewer: API calls and assertions in the test body, not hooks or fixtures. */
const STEP_METHODS = new Set(['pw:api', 'expect']);
const NOISE = /^(Screenshot|Route requests|Unroute requests|Fulfill request|Fetch request|Continue request|Wait for event "response"|GET|POST|PUT|PATCH|DELETE|HEAD)$/;
const PAGE_CALLS = new Set(['fetch', 'xhr']);

export interface EvidenceOptions {
  /** Keep only calls to this origin (for example the app's API). Default: every fetch/XHR of the page and every call of the test. */
  origin?: string;
}

/** Evidence from one Playwright trace.zip. */
export function evidenceOf(traceFile: string, options: EvidenceOptions = {}): Evidence {
  const entries = unzip(traceFile);
  const names = [...entries.keys()];
  const network = names.filter((n) => n.endsWith('.network'));
  const library = names.filter((n) => /^\d+-trace\.trace$/.test(n));
  if (!network.length || !entries.has('test.trace')) throw new Error(`${traceFile}: no test.trace or .network entry; the trace format may have changed.`);

  type Raw = Call & { at: number; fulfilled: boolean; forPage: boolean };
  const calls: Raw[] = [];
  // What the test and the page sent: unique names, e-mails and prices that differ from run to run.
  const data = new Map<string, string>();
  for (const name of network) {
    for (const event of lines(entries.get(name))) {
      const snapshot = event.snapshot as ResourceSnapshot | undefined;
      if (event.type !== 'resource-snapshot' || !snapshot) continue;
      const { request, response, pageref } = snapshot;
      if (request.method === 'OPTIONS') continue;
      if (options.origin ? !request.url.startsWith(options.origin) : pageref && !PAGE_CALLS.has(snapshot._resourceType ?? '')) continue;
      calls.push({
        at: Date.parse(snapshot.startedDateTime),
        fulfilled: Boolean(snapshot._wasFulfilled),
        forPage: !pageref && Boolean(request.headers?.some((h) => /^origin$/i.test(h.name))),
        from: pageref ? 'page' : 'test',
        method: request.method,
        endpoint: endpointOf(request.url),
        status: response.status > 0 ? response.status : 'no response',
        ms: response.status > 0 ? Math.round(snapshot.time) : undefined,
        request: bodyOf(entries, request.postData?._file, request.postData?.mimeType),
        response: bodyOf(entries, response.content?._file, response.content?.mimeType),
        error: response.status >= 400 ? textOf(entries, response.content?._file) : undefined,
      });
      valuesOf(isJson(request.postData?._file ? entries.get(request.postData._file) : undefined), data);
    }
  }
  calls.sort((a, b) => a.at - b.at);
  // A page request the test's route answered: passed on to the app with route.fetch (the fetch shows up as a
  // test request with the page's origin header), or made up by the test, which is evidence in itself.
  for (const call of calls.filter((c) => c.fulfilled)) {
    const fetched = calls.find(
      (c) => c.forPage && c.method === call.method && c.endpoint === call.endpoint && c.at >= call.at && c.at <= call.at + (call.ms ?? 0),
    );
    if (fetched) calls.splice(calls.indexOf(fetched), 1);
    else call.answeredBy = 'the test (route.fulfill), not the app';
  }

  const selectors = new Map<string, string>();
  // The after-snapshot of each call, with the earlier snapshots of its frame that it refers to.
  const pages = new Map<string, { frame: FrameSnapshot[]; index: number }>();
  for (const name of library) {
    const frames = new Map<string, FrameSnapshot[]>();
    for (const event of lines(entries.get(name))) {
      if (event.type === 'before' && event.callId && event.params?.selector) selectors.set(event.callId, event.params.selector);
      if (event.type === 'before' && event.method === 'fill' && event.params?.value) valuesOf(event.params.value, data, 'typed');
      if (event.type !== 'frame-snapshot' || !event.snapshot) continue;
      const snapshot = event.snapshot as FrameSnapshot;
      const frame = frames.get(snapshot.frameId) ?? [];
      frames.set(snapshot.frameId, frame);
      frame.push(snapshot);
      if (snapshot.phase === 'after') pages.set(snapshot.callId, { frame, index: frame.length - 1 });
    }
  }
  const steps = new Map<string, TraceEvent>();
  const ends = new Map<string, TraceEvent>();
  for (const event of lines(entries.get('test.trace'))) {
    if (event.type === 'before' && event.callId) steps.set(event.callId, event);
    if (event.type === 'after' && event.callId) ends.set(event.callId, event);
  }
  const inHook = (event: TraceEvent) => {
    for (let e: TraceEvent | undefined = event; e; e = e.parentId ? steps.get(e.parentId) : undefined) if (e.method === 'hook' || e.method === 'fixture') return true;
    return false;
  };
  const actions: (Action & { at: number })[] = [];
  for (const [callId, before] of steps) {
    if (!STEP_METHODS.has(before.method ?? '') || NOISE.test(before.title ?? '') || inHook(before)) continue;
    const after = ends.get(callId);
    const page = before.method === 'expect' && selectors.has(callId) ? pages.get(callId) : undefined;
    const text = page && targetText(page.frame, page.index);
    actions.push({
      at: before.startTime ?? 0,
      step: before.title ?? '',
      target: selectors.get(callId),
      ms: after?.endTime !== undefined && before.startTime !== undefined ? Math.round(after.endTime - before.startTime) : undefined,
      error: after ? plain(after.error?.message)?.split('\n')[0] : 'never finished',
      shown: text === undefined ? undefined : maskData(text, data),
    });
  }
  actions.sort((a, b) => a.at - b.at);

  const defined = <T extends object>(o: T) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T;
  return {
    calls: calls.map(({ at: _a, fulfilled: _f, forPage: _p, ...call }) => defined(call)),
    actions: actions.map(({ at: _a, ...action }) => defined(action)),
  };
}
