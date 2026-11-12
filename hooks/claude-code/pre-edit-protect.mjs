#!/usr/bin/env node
// PreToolUse hook (Edit|Write): stops the agent from editing the files that hold its own guardrails.
// Contract checked against https://code.claude.com/docs/en/hooks on 2026-11-12 (docs mention Claude Code v2.1.319):
// stdin JSON has tool_input.file_path (absolute; backslashes on Windows) and cwd; exit 2 blocks the call and
// stderr goes back to Claude as the reason.
import path from 'node:path';

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
  /(^|\/)(post-edit-lint|pre-edit-protect)\.m?js$/,
];

async function readStdin() {
  let data = '';
  for await (const chunk of process.stdin) data += chunk;
  return data;
}

const input = JSON.parse((await readStdin()) || '{}');
const filePath = input.tool_input?.file_path;
if (!filePath || process.env.REDFIRST_ALLOW_PROTECTED === '1') process.exit(0);

const root = process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd();
const relative = path.relative(root, path.resolve(root, filePath)).replace(/\\/g, '/');

if (PROTECTED_PATHS.some((re) => re.test(relative))) {
  process.stderr.write(
    `redfirst: ${relative} is protected (test, lint or CI configuration, or the gate itself). ` +
      'Do not edit it. Describe the change you need and why in your reply, and let a human make it.\n',
  );
  process.exit(2);
}
process.exit(0);
