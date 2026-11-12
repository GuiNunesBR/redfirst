import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { loadConfig } from '../../src/config.js';
import type { Finding } from '../../src/core/types.js';
import { runGate, type GateMode, type GateResult } from '../../src/gate/gate.js';
import { dirSource, type FileSource } from '../../src/gate/sources.js';

const ROOT = path.resolve(import.meta.dirname, '../../fixtures/redteam');
const BASE = path.join(ROOT, 'base');

export interface Case {
  id: string;
  kind: 'adversarial' | 'legitimate';
  description: string;
  expected?: string[];
  limit?: string;
  knownFalsePositive?: string;
  mode?: GateMode;
  deleted?: string[];
}

export interface Outcome {
  c: Case;
  result: GateResult;
  /** Gate rule ids plus the lint rules behind each G006. */
  ids: Set<string>;
  flagged: boolean;
  blocked: boolean;
}

export const cases: Case[] = readdirSync(path.join(ROOT, 'cases'))
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

function idsOf(findings: Finding[]): Set<string> {
  const ids = new Set(findings.map((f) => f.rule));
  for (const f of findings) {
    const lint = /^New (TL\d{3})/.exec(f.message);
    if (f.rule === 'G006' && lint) ids.add(lint[1]!);
  }
  return ids;
}

export function runCase(c: Case): Outcome {
  const base = dirSource(BASE);
  const result = runGate({ base, head: headOf(c, base), mode: c.mode, config: loadConfig(BASE) });
  const ids = idsOf(result.findings);
  return { c, result, ids, flagged: !!c.expected && c.expected.every((id) => ids.has(id)), blocked: result.failed };
}

export function summarize(outcomes: Outcome[]) {
  const adversarial = outcomes.filter((o) => o.c.kind === 'adversarial');
  const legitimate = outcomes.filter((o) => o.c.kind === 'legitimate');
  return {
    adversarial: adversarial.length,
    flagged: adversarial.filter((o) => o.flagged).length,
    blocked: adversarial.filter((o) => o.blocked).length,
    limits: adversarial.filter((o) => o.c.limit).length,
    legitimate: legitimate.length,
    falsePositives: legitimate.filter((o) => o.blocked).length,
    documentedFalsePositives: legitimate.filter((o) => o.blocked && o.c.knownFalsePositive).length,
    notBlocked: adversarial.filter((o) => !o.blocked).map((o) => `${o.c.id} (${[...o.ids].sort().join(', ') || 'nothing'})`),
  };
}
