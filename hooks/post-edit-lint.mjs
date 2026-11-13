#!/usr/bin/env node
// PostToolUse hook (Edit|Write): lints the test files the agent just changed and sends errors back to it.
// On exit 2 the edit has already happened; Claude Code and Codex show stderr to the agent.
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { editedFiles } from './edited-files.mjs';

const TEST_FILE = /\.(spec|test|cy)\.[cm]?[jt]sx?$/;
const TEST_DIR = /(^|\/)(tests?|e2e|cypress)\/.*\.[cm]?[jt]sx?$/;

/** The project's installed redfirst, or the one this hook ships with (absent in a plugin installed from git). */
function findCli(root) {
  try {
    const pkg = createRequire(path.join(root, 'package.json')).resolve('redfirst/package.json');
    return path.join(path.dirname(pkg), 'dist', 'cli.js');
  } catch {
    return path.resolve(import.meta.dirname, '../dist/cli.js');
  }
}

const { root, files } = await editedFiles();
const tests = files.filter((file) => (TEST_FILE.test(file) || TEST_DIR.test(file)) && existsSync(path.join(root, file)));
if (!tests.length) process.exit(0);

const cli = findCli(root);
if (!existsSync(cli)) process.exit(0);

const result = spawnSync(process.execPath, [cli, 'lint', ...tests], { cwd: root, encoding: 'utf8' });
if (result.status === 1) {
  process.stderr.write(`redfirst lint found problems in ${tests.join(', ')}. Fix them without weakening any assertion:\n${result.stdout}`);
  process.exit(2);
}
process.exit(0);
