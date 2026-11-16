import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import type { Framework } from './core/types.js';

export type RuleSetting = 'off' | 'warn' | 'error';

export interface Config {
  rules: Record<string, RuleSetting>;
  include?: string[];
  exclude?: string[];
  framework?: Framework;
  /** Extra contract schema globs for the gate, on top of `schemas.ts`, `contracts/` and `*.schema.ts`. */
  contracts?: string[];
}

export const CONFIG_FILE = '.redfirstrc.json';

export function loadConfig(cwd: string, file?: string): Config {
  const target = file ? path.resolve(cwd, file) : path.join(cwd, CONFIG_FILE);
  if (!existsSync(target)) {
    if (file) throw new Error(`Config file not found: ${file}`);
    return { rules: {} };
  }
  const raw = JSON.parse(readFileSync(target, 'utf8')) as Partial<Config>;
  for (const [rule, setting] of Object.entries(raw.rules ?? {})) {
    if (!['off', 'warn', 'error'].includes(setting)) throw new Error(`Invalid setting for ${rule} in ${target}: ${setting}`);
  }
  return { rules: raw.rules ?? {}, include: raw.include, exclude: raw.exclude, framework: raw.framework, contracts: raw.contracts };
}
