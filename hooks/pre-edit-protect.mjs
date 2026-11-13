#!/usr/bin/env node
// PreToolUse hook (Edit|Write): stops the agent from editing the files that hold its own guardrails.
// Exit 2 blocks the call in Claude Code, Codex and Grok Build; stderr goes back to the agent as the reason.
import { editedFiles } from './edited-files.mjs';

// Keep in sync with src/gate/protected.ts (a test checks it).
const PROTECTED_PATHS = [
  /(^|\/)playwright\.config\.[cm]?[jt]s$/,
  /(^|\/)cypress\.config\.[cm]?[jt]s$/,
  /(^|\/)(vitest|jest)\.config\.[cm]?[jt]s$/,
  /(^|\/)\.redfirstrc\.json$/,
  /(^|\/)eslint\.config\.[cm]?[jt]s$/,
  /(^|\/)\.eslintrc(\.[a-z]+)?$/,
  /(^|\/)tsconfig[^/]*\.json$/,
  /^\.github\/workflows\//,
  /(^|\/)CODEOWNERS$/,
  /^\.claude\/(settings[^/]*\.json|hooks\/)/,
  /^\.codex\/(config\.toml|hooks\.json|hooks\/)/,
  /^\.grok\/hooks\//,
  /(^|\/)(post-edit-lint|pre-edit-protect|edited-files)\.m?js$/,
];

if (process.env.REDFIRST_ALLOW_PROTECTED === '1') process.exit(0);

const { files } = await editedFiles();
const blocked = files.filter((file) => PROTECTED_PATHS.some((re) => re.test(file)));

if (blocked.length) {
  process.stderr.write(
    `redfirst: ${blocked.join(', ')} ${blocked.length === 1 ? 'is' : 'are'} protected (test, lint or CI configuration, or the gate itself). ` +
      'Do not edit it. Describe the change you need and why in your reply, and let a human make it.\n',
  );
  process.exit(2);
}
process.exit(0);
