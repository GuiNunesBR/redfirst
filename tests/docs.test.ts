import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { DISABLE_WITHOUT_REASON, RULES } from '../src/lint/registry.js';
import { cases, runCase, summarize } from './support/redteam.js';

const ROOT = path.resolve(import.meta.dirname, '..');
const read = (file: string) => readFileSync(path.join(ROOT, file), 'utf8');
const lines = (file: string) => read(file).trimEnd().split(/\r?\n/).length;

const LINT_IDS = [DISABLE_WITHOUT_REASON.id, ...RULES.map((r) => r.id)];
const GATE_IDS = ['G001', 'G002', 'G003', 'G004', 'G005', 'G006', 'G007', 'G008', 'G009'];

describe('docs', () => {
  it.each([...LINT_IDS, ...GATE_IDS])('%s is documented in docs/rules.md and the README', (id) => {
    expect(read('docs/rules.md')).toContain(`| ${id} |`);
    expect(read('README.md')).toContain(id);
  });

  it('keeps SKILL.md and AGENTS.md short', () => {
    expect(lines('skills/redfirst/SKILL.md')).toBeLessThanOrEqual(150);
    expect(lines('AGENTS.md')).toBeLessThanOrEqual(45);
  });

  it('starts SKILL.md with frontmatter that names and describes the skill', () => {
    const skill = read('skills/redfirst/SKILL.md');
    expect(skill).toMatch(/^---\r?\n/);
    expect(skill).toMatch(/^name: redfirst\r?$/m);
    expect(skill).toMatch(/^description: .{40,}\r?$/m);
  });

  it('shows the red-team numbers that the corpus actually produces', () => {
    const s = summarize(cases.map(runCase));
    const readme = read('README.md');
    expect(readme).toContain(`**${s.flagged} / ${s.adversarial}**`);
    expect(readme).toContain(`**${s.blocked} / ${s.adversarial}**`);
    expect(readme).toContain(`**${s.falsePositives} / ${s.legitimate}**`);
    expect(readme).toContain(`holds ${s.adversarial} changes`);
    expect(readme).toContain(`and ${s.legitimate} legitimate changes`);
  }, 60_000);
});
