import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config.js';
import type { Finding } from '../src/core/types.js';
import { runGate, type GateMode } from '../src/gate/gate.js';
import { dirSource, type FileSource } from '../src/gate/sources.js';

const ROOT = path.resolve(import.meta.dirname, '../fixtures/redteam');
const BASE = path.join(ROOT, 'base');

interface Case {
  id: string;
  kind: 'adversarial' | 'legitimate';
  description: string;
  expected?: string[];
  limit?: string;
  knownFalsePositive?: string;
  mode?: GateMode;
  deleted?: string[];
}

const cases: Case[] = readdirSync(path.join(ROOT, 'cases'))
  .sort()
  .map((id) => ({ id, ...JSON.parse(readFileSync(path.join(ROOT, 'cases', id, 'case.json'), 'utf8')) }));

/** Base project with the case's files laid over it. */
function headOf(c: Case, base: FileSource): FileSource {
  const overrides = path.join(ROOT, 'cases', c.id, 'head');
  const changed = existsSync(overrides) ? dirSource(overrides) : undefined;
  const deleted = new Set(c.deleted ?? []);
  return {
    label: c.id,
    files: () => [...new Set([...base.files(), ...(changed?.files() ?? [])])].filter((f) => !deleted.has(f)),
    read: (file) => (deleted.has(file) ? undefined : (changed?.read(file) ?? base.read(file))),
  };
}

/** Gate rule ids plus the lint rules behind each G006. */
function flaggedIds(findings: Finding[]): Set<string> {
  const ids = new Set(findings.map((f) => f.rule));
  for (const f of findings) {
    const lint = /^New (TL\d{3})/.exec(f.message);
    if (f.rule === 'G006' && lint) ids.add(lint[1]!);
  }
  return ids;
}

const outcomes: { c: Case; flagged: boolean; blocked: boolean; rules: string[] }[] = [];

describe('red-team corpus', () => {
  const base = dirSource(BASE);
  const config = loadConfig(BASE);

  it.each(cases.map((c) => [c.id, c] as const))('%s', (_id, c) => {
    const result = runGate({ base, head: headOf(c, base), mode: c.mode, config });
    const ids = flaggedIds(result.findings);
    const flagged = !!c.expected && c.expected.every((id) => ids.has(id));
    outcomes.push({ c, flagged, blocked: result.failed, rules: [...ids].sort() });

    if (c.kind === 'adversarial' && c.expected) {
      expect([...ids], c.description).toEqual(expect.arrayContaining(c.expected));
    } else if (c.kind === 'adversarial') {
      // A documented limit: if this starts failing, the gate got better and docs/limits.md needs updating.
      expect(result.failed, `${c.description}: ${c.limit}`).toBe(false);
    } else if (c.knownFalsePositive) {
      expect(result.failed, c.knownFalsePositive).toBe(true);
    } else {
      expect(result.findings.filter((f) => f.severity === 'error'), c.description).toEqual([]);
    }
  });

  afterAll(() => {
    const adversarial = outcomes.filter((o) => o.c.kind === 'adversarial');
    const legitimate = outcomes.filter((o) => o.c.kind === 'legitimate');
    const flagged = adversarial.filter((o) => o.flagged).length;
    const blocked = adversarial.filter((o) => o.blocked).length;
    const limits = adversarial.filter((o) => o.c.limit).length;
    const falsePositives = legitimate.filter((o) => o.blocked).length;
    const known = legitimate.filter((o) => o.blocked && o.c.knownFalsePositive).length;
    console.log(
      [
        '',
        `red team: flagged ${flagged}/${adversarial.length} adversarial changes, blocked ${blocked}/${adversarial.length}, ${limits} documented limit(s)`,
        `red team: false positives ${falsePositives}/${legitimate.length} legitimate changes (${known} documented)`,
        ...adversarial.filter((o) => !o.blocked).map((o) => `  not blocked: ${o.c.id} (${o.rules.join(', ') || 'nothing'})`),
      ].join('\n'),
    );
  });
});
