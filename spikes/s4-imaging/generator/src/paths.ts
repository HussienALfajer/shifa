import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** The repository root: the nearest parent holding pnpm-workspace.yaml. */
export function repoRoot(): string {
  let dir = dirname(fileURLToPath(import.meta.url));
  while (!existsSync(join(dir, 'pnpm-workspace.yaml'))) {
    const parent = dirname(dir);
    if (parent === dir) throw new Error('repository root not found');
    dir = parent;
  }
  return dir;
}

/** `.cache/s4/<parts>` under the repository root (git-ignored, never committed). */
export const cacheDir = (...parts: string[]): string => join(repoRoot(), '.cache', 's4', ...parts);
