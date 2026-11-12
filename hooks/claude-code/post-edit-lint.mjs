#!/usr/bin/env node
// PostToolUse hook (Edit|Write): lints the test file the agent just changed and sends errors back to it.
// Contract checked against https://code.claude.com/docs/en/hooks on 2026-11-12 (docs mention Claude Code v2.1.319):
// stdin JSON has tool_input.file_path (absolute; backslashes on Windows) and cwd; on exit 2 the tool has already
// run and stderr is shown to Claude.
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

const TEST_FILE = /\.(spec|test|cy)\.[cm]?[jt]sx?$/;
const TEST_DIR = /(^|\/)(tests?|e2e|cypress)\/.*\.[cm]?[jt]sx?$/;

async function readStdin() {
  let data = '';
  for await (const chunk of process.stdin) data += chunk;
  return data;
}

/** The project's installed redfirst, or the one this hook ships with. */
function findCli(root) {
  try {
    const pkg = createRequire(path.join(root, 'package.json')).resolve('redfirst/package.json');
    return path.join(path.dirname(pkg), 'dist', 'cli.js');
  } catch {
    const bundled = path.resolve(import.meta.dirname, '../../dist/cli.js');
    return existsSync(bundled) ? bundled : null;
  }
}

const input = JSON.parse((await readStdin()) || '{}');
const filePath = input.tool_input?.file_path;
if (!filePath) process.exit(0);

const root = process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd();
const relative = path.relative(root, path.resolve(root, filePath)).replace(/\\/g, '/');
if (!TEST_FILE.test(relative) && !TEST_DIR.test(relative)) process.exit(0);

const cli = findCli(root);
if (!cli || !existsSync(cli)) process.exit(0);

const result = spawnSync(process.execPath, [cli, 'lint', relative], { cwd: root, encoding: 'utf8' });
if (result.status === 1) {
  process.stderr.write(`redfirst lint found problems in ${relative}. Fix them without weakening any assertion:\n${result.stdout}`);
  process.exit(2);
}
process.exit(0);
