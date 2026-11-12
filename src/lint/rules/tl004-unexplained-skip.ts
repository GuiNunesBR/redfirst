import type { Analysis } from '../../core/analyze.js';
import type { Rule } from '../rule.js';

/** An issue number (#123), a ticket key (JIRA-1) or a URL. */
export const ISSUE_REF = /(#\d+|\b[A-Z][A-Z0-9]+-\d+\b|https?:\/\/\S+)/;

function commentOn(analysis: Analysis, line: number): string {
  const text = analysis.text.split(/\r?\n/)[line - 1] ?? '';
  const at = text.search(/\/\/|\/\*/);
  return at >= 0 ? text.slice(at) : '';
}

function explained(analysis: Analysis, line: number, reason: string | null): boolean {
  return [reason ?? '', commentOn(analysis, line), commentOn(analysis, line - 1)].some((t) => ISSUE_REF.test(t));
}

export const unexplainedSkip: Rule = {
  id: 'TL004',
  name: 'unexplained-skip',
  severity: 'warn',
  applies: 'both',
  description: 'A skipped test without an issue link becomes permanent dead weight.',
  fix: 'Add an issue link (#123, JIRA-1 or a URL) in the reason or in a comment on the line above.',
  check({ analysis, report }) {
    for (const block of analysis.blocks) {
      if ((block.skip || block.fixme) && !explained(analysis, block.line, null)) {
        report(block.call, `Skipped ${block.kind} "${block.title}" has no issue link.`, block.kind === 'test' ? block : undefined);
      }
    }
    for (const skip of analysis.inlineSkips) {
      if (!explained(analysis, skip.line, skip.reason)) report(skip.call, 'Skip without an issue link in its reason.');
    }
  },
};
