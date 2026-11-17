import { execFileSync } from 'node:child_process';
import path from 'node:path';

/**
 * Builds dist/ once, before any test file runs. Tests that start the CLI or the hooks as processes read it;
 * building it inside those files made two compilers write dist/ at the same time while another read it.
 */
export default function build() {
  const root = path.resolve(import.meta.dirname, '..');
  execFileSync(process.execPath, [path.join(root, 'node_modules', 'typescript', 'bin', 'tsc'), '-p', 'tsconfig.build.json'], { cwd: root, stdio: 'inherit' });
}
