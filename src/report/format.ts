import type { Finding } from '../core/types.js';

export type Format = 'text' | 'json' | 'github';
export const FORMATS: Format[] = ['text', 'json', 'github'];

export interface Summary {
  tool: 'lint' | 'gate';
  errors: number;
  warnings: number;
  /** Final line shown in text output, e.g. "gate: PASS". */
  verdict: string;
  files?: number;
}

export function summarize(tool: Summary['tool'], findings: Finding[], failed: boolean, files?: number): Summary {
  const errors = findings.filter((f) => f.severity === 'error').length;
  const warnings = findings.length - errors;
  const counts = `${errors} error${errors === 1 ? '' : 's'}, ${warnings} warning${warnings === 1 ? '' : 's'}`;
  const scope = files === undefined ? '' : ` in ${files} file${files === 1 ? '' : 's'}`;
  return { tool, errors, warnings, files, verdict: `${tool}: ${failed ? 'FAIL' : 'PASS'} (${counts}${scope})` };
}

const diffLines = (f: Finding) => (f.diff ? [`    - ${f.diff.before}`, `    + ${f.diff.after}`] : []);

function text(findings: Finding[], summary: Summary): string {
  const lines = findings.flatMap((f) => {
    const where = `${f.file}:${f.line}:${f.column}`;
    const test = f.test ? ` [${f.test}]` : '';
    return [`${where}  ${f.severity.padEnd(5)}  ${f.rule}  ${f.message}${test}`, ...diffLines(f)];
  });
  return [...lines, ...(lines.length ? [''] : []), summary.verdict].join('\n');
}

/** Workflow commands: https://docs.github.com/actions/reference/workflow-commands-for-github-actions */
function escapeData(value: string): string {
  return value.replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');
}

function escapeProperty(value: string): string {
  return escapeData(value).replace(/:/g, '%3A').replace(/,/g, '%2C');
}

function github(findings: Finding[], summary: Summary): string {
  const lines = findings.map((f) => {
    const level = f.severity === 'error' ? 'error' : 'warning';
    const props = `file=${escapeProperty(f.file)},line=${f.line},col=${f.column},title=${escapeProperty(`redfirst ${f.rule}`)}`;
    const test = f.test ? ` [${f.test}]` : '';
    return `::${level} ${props}::${escapeData([f.message + test, ...diffLines(f)].join('\n'))}`;
  });
  return [...lines, summary.verdict].join('\n');
}

export function format(findings: Finding[], summary: Summary, as: Format): string {
  if (as === 'json') return JSON.stringify({ summary, findings }, null, 2);
  if (as === 'github') return github(findings, summary);
  return text(findings, summary);
}
