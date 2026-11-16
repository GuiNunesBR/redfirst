import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { crc32 } from 'node:zlib';

/** A stored (uncompressed) zip, as small as the reader needs. */
export function zip(entries: Record<string, string>): Buffer {
  const local: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;
  for (const [name, text] of Object.entries(entries)) {
    const data = Buffer.from(text);
    const nameBytes = Buffer.from(name);
    const header = Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50, 0);
    header.writeUInt32LE(crc32(data), 14);
    header.writeUInt32LE(data.length, 18);
    header.writeUInt32LE(data.length, 22);
    header.writeUInt16LE(nameBytes.length, 26);
    local.push(header, nameBytes, data);
    const entry = Buffer.alloc(46);
    entry.writeUInt32LE(0x02014b50, 0);
    entry.writeUInt32LE(crc32(data), 16);
    entry.writeUInt32LE(data.length, 20);
    entry.writeUInt32LE(data.length, 24);
    entry.writeUInt16LE(nameBytes.length, 28);
    entry.writeUInt32LE(offset, 42);
    central.push(entry, nameBytes);
    offset += 30 + nameBytes.length + data.length;
  }
  const size = central.reduce((n, b) => n + b.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(Object.keys(entries).length, 8);
  end.writeUInt16LE(Object.keys(entries).length, 10);
  end.writeUInt32LE(size, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...local, ...central, end]);
}

const jsonl = (events: unknown[]) => events.map((e) => JSON.stringify(e)).join('\n');

export interface RunOptions {
  /**
   * How the test fails: `wait` is the test's wait for the old endpoint timing out, `click` is a click whose
   * locator finds nothing. Default: it passes.
   */
  failure?: 'wait' | 'click';
  /** Runs of the test in the report, as `--repeat-each` writes them. */
  repeats?: number;
  /** The test answers the page's request itself instead of letting the app do it. */
  faked?: boolean;
}

/**
 * A Playwright-like report of one UI test, "lists the users", and its trace: the page loads the list from
 * `endpoint`, the test clicks a row and asserts on the list.
 */
export function writeRun(dir: string, endpoint: string, options: RunOptions = {}): string {
  mkdirSync(dir, { recursive: true });
  const click = options.failure === 'click';
  const body = JSON.stringify({ users: [{ id: 'aB3dE5gH7jK9mN1p', name: 'Ana' }] });
  const trace = zip({
    'test.trace': jsonl([
      { type: 'before', callId: 'c1', method: 'pw:api', title: 'Navigate', startTime: 1 },
      { type: 'after', callId: 'c1', endTime: 100 },
      { type: 'before', callId: 'c2', method: 'pw:api', title: 'Click', startTime: 101 },
      click ? { type: 'after', callId: 'c2', endTime: 5101, error: { message: 'TimeoutError: locator.click: Timeout 5000ms exceeded.' } } : { type: 'after', callId: 'c2', endTime: 120 },
      ...(click
        ? []
        : [
            { type: 'before', callId: 'c3', method: 'expect', title: 'Expect "toHaveCount"', startTime: 121 },
            { type: 'after', callId: 'c3', endTime: 150 },
          ]),
    ]),
    '0-trace.trace': jsonl([
      { type: 'before', callId: 'c2', params: { selector: 'internal:testid=[data-testid="row"s]' } },
      { type: 'before', callId: 'c3', params: { selector: 'internal:role=row' } },
    ]),
    '0-trace.network': jsonl([
      {
        type: 'resource-snapshot',
        snapshot: {
          pageref: 'page@1',
          _resourceType: 'fetch',
          _wasFulfilled: options.faked,
          startedDateTime: '2026-01-01T00:00:00.050Z',
          time: 40,
          request: { method: 'GET', url: `http://app.test${endpoint}`, headers: [] },
          response: { status: 200, content: { _file: 'resources/list.json', mimeType: 'application/json' } },
        },
      },
    ]),
    'resources/list.json': body,
  });
  writeFileSync(path.join(dir, 'trace.zip'), trace);
  const message = click
    ? 'TimeoutError: locator.click: Timeout 5000ms exceeded.\nCall log:\n  - waiting for getByTestId(\'row\')'
    : 'Error: page.waitForResponse: Timeout 5000ms exceeded.';
  const result = {
    status: options.failure ? 'failed' : 'passed',
    errors: options.failure ? [{ message, location: { file: 'tests/users.spec.ts', line: 7 } }] : [],
    attachments: [{ name: 'trace', path: 'trace.zip', contentType: 'application/zip' }],
  };
  const tests = Array.from({ length: options.repeats ?? 1 }, () => ({ projectName: 'chromium', results: [result] }));
  const report = { suites: [{ specs: [{ title: 'lists the users', file: 'users.spec.ts', line: 3, tests }] }] };
  const file = path.join(dir, 'report.json');
  writeFileSync(file, JSON.stringify(report));
  return file;
}
