import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { lintText } from '../src/lint/engine.js';
import { DISABLE_WITHOUT_REASON, RULES } from '../src/lint/registry.js';

const FIXTURES = path.resolve(import.meta.dirname, '../fixtures');
const MARKER = /\/\/\s*expect:\s*([A-Z0-9, ]+?)\s*$/;

function filesIn(dir: string): string[] {
  return readdirSync(path.join(FIXTURES, dir)).map((f) => `${dir}/${f}`);
}

/** `line:rule` pairs marked with `// expect: TL001` in the fixture. */
function expectedMarks(text: string): string[] {
  return text.split(/\r?\n/).flatMap((line, index) => {
    const match = MARKER.exec(line);
    return match ? match[1]!.split(',').map((rule) => `${index + 1}:${rule.trim()}`) : [];
  });
}

function reported(file: string, text: string): string[] {
  return lintText(file, text).map((f) => `${f.line}:${f.rule}`);
}

describe.each(['playwright', 'cypress'])('%s fixtures', (framework) => {
  it.each(filesIn(`${framework}/bad`))('%s reports exactly the marked lines', (file) => {
    const text = readFileSync(path.join(FIXTURES, file), 'utf8');
    const marks = expectedMarks(text);
    expect(marks.length).toBeGreaterThan(0);
    expect(reported(file, text).sort()).toEqual(marks.sort());
  });

  it.each(filesIn(`${framework}/good`))('%s is clean', (file) => {
    const text = readFileSync(path.join(FIXTURES, file), 'utf8');
    expect(lintText(file, text)).toEqual([]);
  });
});

describe('fixture coverage', () => {
  const marked = new Set(
    ['playwright/bad', 'cypress/bad'].flatMap((dir) =>
      filesIn(dir).flatMap((file) => expectedMarks(readFileSync(path.join(FIXTURES, file), 'utf8')).map((m) => m.split(':')[1])),
    ),
  );

  it.each([...RULES.map((r) => r.id), DISABLE_WITHOUT_REASON.id])('%s has at least one bad fixture', (id) => {
    expect(marked.has(id)).toBe(true);
  });
});

describe('configuration', () => {
  const text = readFileSync(path.join(FIXTURES, 'playwright/bad/TL007.spec.ts'), 'utf8');

  it('turns a rule off', () => {
    const findings = lintText('TL007.spec.ts', text, { config: { rules: { TL007: 'off' } } });
    expect(findings).toEqual([]);
  });

  it('raises a warning to an error', () => {
    const findings = lintText('TL007.spec.ts', text, { config: { rules: { TL007: 'error' } } });
    expect(new Set(findings.map((f) => f.severity))).toEqual(new Set(['error']));
  });

  it('applies framework rules only to their framework', () => {
    const cypressText = 'it("x", async () => { await cy.visit("/"); cy.get("a").should("have.text", "b"); });';
    expect(lintText('a.cy.ts', cypressText).map((f) => f.rule)).toContain('TL010');
    expect(lintText('a.spec.ts', cypressText, { framework: 'playwright' }).map((f) => f.rule)).not.toContain('TL010');
  });

  it('attaches the full test title to findings', () => {
    const [finding] = lintText('TL003.spec.ts', readFileSync(path.join(FIXTURES, 'playwright/bad/TL003.spec.ts'), 'utf8')).filter(
      (f) => f.test,
    );
    expect(finding?.test).toBe('cart › adds an item');
  });
});
