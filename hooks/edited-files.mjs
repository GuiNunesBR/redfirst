// Reads a PreToolUse/PostToolUse payload and returns the project root and the files the edit touches,
// relative to the root with forward slashes.
// Claude Code (and Grok Build, which reads Claude Code hooks) sends tool_input.file_path, absolute, with
// backslashes on Windows. Codex sends apply_patch with the patch text in tool_input.command; the files are in
// its "*** Add File:", "*** Update File:", "*** Delete File:" and "*** Move to:" headers.
// Checked against code.claude.com/docs/en/hooks, developers.openai.com/codex/hooks and
// docs.x.ai/build/features/hooks on 2026-11-13.
import path from 'node:path';

const PATCH_HEADER = /^\*\*\* (?:Add File|Update File|Delete File|Move to): (.+)$/gm;

async function readStdin() {
  let data = '';
  for await (const chunk of process.stdin) data += chunk;
  return data;
}

export async function editedFiles() {
  const input = JSON.parse((await readStdin()) || '{}');
  const root = process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd();
  const toolInput = input.tool_input ?? {};
  const raw = [];
  if (typeof toolInput.file_path === 'string') raw.push(toolInput.file_path);
  if (typeof toolInput.command === 'string' && /^\*\*\* Begin Patch/m.test(toolInput.command)) {
    for (const match of toolInput.command.matchAll(PATCH_HEADER)) raw.push(match[1].trim());
  }
  const files = [...new Set(raw.map((file) => path.relative(root, path.resolve(root, file)).replace(/\\/g, '/')))];
  return { root, files };
}
