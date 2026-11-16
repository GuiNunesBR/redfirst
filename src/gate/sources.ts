import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { globSync } from 'tinyglobby';

/** One side of a comparison: a git ref, the working tree, or a plain directory. */
export interface FileSource {
  label: string;
  files(): string[];
  read(file: string): string | undefined;
}

const toPosix = (p: string) => p.replace(/\\/g, '/');

function git(cwd: string, args: string[]): string {
  return execFileSync('git', args, { cwd, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
}

export function gitRefSource(cwd: string, ref: string): FileSource {
  // A ref that starts with '-' would reach git as an option (git diff --output=<file> writes to disk).
  if (ref.startsWith('-')) throw new Error(`Unknown git ref: ${ref}`);
  try {
    git(cwd, ['rev-parse', '--verify', '--quiet', `${ref}^{commit}`]);
  } catch {
    throw new Error(`Unknown git ref: ${ref}`);
  }
  const cache = new Map<string, string | undefined>();
  let list: string[] | undefined;
  return {
    label: ref,
    files() {
      list ??= git(cwd, ['ls-tree', '-r', '--name-only', '-z', ref]).split('\0').filter(Boolean);
      return list;
    },
    read(file) {
      if (!cache.has(file)) {
        try {
          cache.set(file, git(cwd, ['show', `${ref}:${file}`]));
        } catch {
          cache.set(file, undefined);
        }
      }
      return cache.get(file);
    },
  };
}

/** Tracked and untracked (not ignored) files in the working tree. */
export function worktreeSource(cwd: string): FileSource {
  const root = git(cwd, ['rev-parse', '--show-toplevel']).trim();
  return {
    label: 'working tree',
    files() {
      return git(root, ['ls-files', '-z', '--cached', '--others', '--exclude-standard'])
        .split('\0')
        .filter((f) => f && existsSync(path.join(root, f)));
    },
    read(file) {
      const full = path.join(root, file);
      return existsSync(full) && statSync(full).isFile() ? readFileSync(full, 'utf8') : undefined;
    },
  };
}

export function dirSource(dir: string): FileSource {
  const root = path.resolve(dir);
  if (!existsSync(root)) throw new Error(`Directory not found: ${dir}`);
  return {
    label: toPosix(dir),
    files() {
      return globSync('**/*', { cwd: root, dot: true, ignore: ['**/node_modules/**', '**/.git/**'] }).map(toPosix);
    },
    read(file) {
      const full = path.join(root, file);
      return existsSync(full) ? readFileSync(full, 'utf8') : undefined;
    },
  };
}

/**
 * Files that differ between `base` and `head` (or the working tree, untracked files included).
 * Asking git is much faster than reading every file on both sides.
 */
export function gitChangedFiles(root: string, base: string, head?: string): string[] {
  const diff = git(root, ['diff', '--name-only', '--no-renames', '-z', base, ...(head ? [head] : [])]).split('\0');
  const untracked = head ? [] : git(root, ['ls-files', '-z', '--others', '--exclude-standard']).split('\0');
  return [...new Set([...diff, ...untracked].filter(Boolean))].sort();
}

export function gitRoot(cwd: string): string {
  return git(cwd, ['rev-parse', '--show-toplevel']).trim();
}
