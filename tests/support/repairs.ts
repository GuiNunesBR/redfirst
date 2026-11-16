import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { runGate, type GateResult } from '../../src/gate/gate.js';
import { dirSource, type FileSource } from '../../src/gate/sources.js';

const CORPUS = path.resolve(import.meta.dirname, '../../fixtures/failures');

export interface Repair {
  caseId: string;
  name: string;
  split: 'dev' | 'holdout';
  kind: 'honest' | 'cheat';
  technique: string;
  expected: 'accept' | 'block';
  description: string;
  limit?: string;
}

export interface RepairOutcome {
  repair: Repair;
  result: GateResult;
  verdict: 'accept' | 'block';
}

/** `top` laid over `bottom`: files from `top` win, the rest come from `bottom`. */
function overlay(bottom: FileSource, top: FileSource | undefined, label: string): FileSource {
  if (!top) return bottom;
  return {
    label,
    files: () => [...new Set([...bottom.files(), ...top.files()])],
    read: (file) => top.read(file) ?? bottom.read(file),
  };
}

const optionalDir = (dir: string) => (existsSync(dir) ? dirSource(dir) : undefined);

export const repairs: Repair[] = readdirSync(path.join(CORPUS, 'cases'))
  .sort()
  .flatMap((caseId) => {
    const dir = path.join(CORPUS, 'cases', caseId, 'repairs');
    if (!existsSync(dir)) return [];
    const { split } = JSON.parse(readFileSync(path.join(CORPUS, 'cases', caseId, 'case.json'), 'utf8'));
    return readdirSync(dir)
      .sort()
      .map((name) => ({ caseId, name, split, ...JSON.parse(readFileSync(path.join(dir, name, 'repair.json'), 'utf8')) }));
  });

/** The gate in heal mode, from the broken suite to the repaired one. */
export function runRepair(repair: Repair): RepairOutcome {
  const caseDir = path.join(CORPUS, 'cases', repair.caseId);
  const broken = overlay(dirSource(path.join(CORPUS, 'suite')), optionalDir(path.join(caseDir, 'suite')), repair.caseId);
  const repaired = overlay(broken, dirSource(path.join(caseDir, 'repairs', repair.name, 'files')), repair.name);
  const result = runGate({ base: broken, head: repaired, mode: 'heal' });
  return { repair, result, verdict: result.failed ? 'block' : 'accept' };
}

export function summarizeRepairs(outcomes: RepairOutcome[]) {
  const by = (split: Repair['split']) => {
    const of = outcomes.filter((o) => o.repair.split === split);
    const cheats = of.filter((o) => o.repair.kind === 'cheat');
    const honest = of.filter((o) => o.repair.kind === 'honest');
    return {
      cheats: cheats.length,
      cheatsBlocked: cheats.filter((o) => o.verdict === 'block').length,
      honest: honest.length,
      honestAccepted: honest.filter((o) => o.verdict === 'accept').length,
    };
  };
  return { dev: by('dev'), holdout: by('holdout') };
}
