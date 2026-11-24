#!/usr/bin/env node
// Prints the results of one or more `claude plugin eval` runs as a table: per case and per grader, the pass
// rate with and without the plugin, the difference, and the 95% Wilson interval of each rate.
// Usage: node scripts/evals/summarize.mjs evals/results/<run>/aggregate-result.json [...]
import { readFileSync } from 'node:fs';

const files = process.argv.slice(2);
if (!files.length) {
  console.error('usage: summarize.mjs <aggregate-result.json> [...]');
  process.exit(1);
}

/** 95% Wilson score interval for k passes in n runs. */
export function wilson(k, n, z = 1.96) {
  if (n === 0) return [0, 1];
  const p = k / n;
  const denom = 1 + (z * z) / n;
  const center = (p + (z * z) / (2 * n)) / denom;
  const half = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / denom;
  return [Math.max(0, center - half), Math.min(1, center + half)];
}

// case -> arm -> { runs: score[], graders: name -> passed[] }
const cases = new Map();
let cost = 0;
for (const file of files) {
  const result = JSON.parse(readFileSync(file, 'utf8'));
  cost += result.costUsd ?? 0;
  for (const c of result.cases) {
    const byArm = cases.get(c.name) ?? new Map();
    cases.set(c.name, byArm);
    for (const [arm, runs] of Object.entries(c.arms ?? {})) {
      const entry = byArm.get(arm) ?? { scores: [], passed: [], graders: new Map() };
      byArm.set(arm, entry);
      for (const run of runs) {
        if (run.error) continue;
        entry.scores.push(run.score);
        entry.passed.push(run.graders.filter((g) => g.scored !== false).every((g) => g.passed));
        for (const g of run.graders) {
          const list = entry.graders.get(g.name) ?? [];
          list.push(g.passed);
          entry.graders.set(g.name, list);
        }
      }
    }
  }
}

const pct = (x) => `${Math.round(x * 100)}%`;
const rate = (list) => {
  if (!list?.length) return { text: '-', p: undefined };
  const k = list.filter(Boolean).length;
  const [lo, hi] = wilson(k, list.length);
  return { text: `${k}/${list.length} (${pct(lo)}–${pct(hi)})`, p: k / list.length };
};
const delta = (a, b) => (a.p === undefined || b.p === undefined ? '-' : `${a.p - b.p >= 0 ? '+' : ''}${(a.p - b.p).toFixed(2)}`);
const mean = (xs) => (xs.length ? (xs.reduce((s, x) => s + x, 0) / xs.length).toFixed(2) : '-');

const rows = [['case / grader', 'with', 'without', 'Δ']];
for (const [name, byArm] of [...cases].sort(([a], [b]) => a.localeCompare(b))) {
  const w = byArm.get('with') ?? { scores: [], passed: [], graders: new Map() };
  const wo = byArm.get('without') ?? { scores: [], passed: [], graders: new Map() };
  const rw = rate(w.passed);
  const rwo = rate(wo.passed);
  rows.push([`**${name}** (all graders; mean score ${mean(w.scores)} / ${mean(wo.scores)})`, rw.text, rwo.text, delta(rw, rwo)]);
  const graders = [...new Set([...w.graders.keys(), ...wo.graders.keys()])].sort();
  for (const g of graders) {
    const a = rate(w.graders.get(g));
    const b = rate(wo.graders.get(g));
    rows.push([`  ${g}`, a.text, b.text, delta(a, b)]);
  }
}

const line = (cells) => `| ${cells.join(' | ')} |`;
console.log(line(rows[0]));
console.log(line(rows[0].map(() => '---')));
for (const row of rows.slice(1)) console.log(line(row));
console.log(`\n${files.length} run(s), cost $${cost.toFixed(2)}. Rates are runs that passed, with the 95% Wilson interval.`);
