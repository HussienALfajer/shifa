// Workspace facts that verify needs at run time (kept out of lib/verify-steps.mjs, which reads
// no files).
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';

/**
 * The Turborepo names of the pub workspace members (root pubspec.yaml `workspace:`): the
 * packages whose tasks need the Flutter SDK. CI's `dart` part runs exactly these and its `node`
 * part every other package (OD-34), so a new Dart package moves to the right job by itself.
 * @param {string} root repository root
 * @returns {string[]}
 */
export function dartWorkspacePackages(root) {
  const pubspec = parse(readFileSync(join(root, 'pubspec.yaml'), 'utf8'));
  const members = pubspec?.workspace;
  if (!Array.isArray(members) || members.length === 0) {
    throw new Error('pubspec.yaml lists no workspace members');
  }
  return members.map((dir) => {
    const manifest = join(root, String(dir), 'package.json');
    if (!existsSync(manifest)) {
      throw new Error(`${dir} is in the pub workspace but has no package.json for Turborepo`);
    }
    const { name } = JSON.parse(readFileSync(manifest, 'utf8'));
    // The name ends up in a command line (Windows joins arguments for the shell).
    if (typeof name !== 'string' || !/^@?[a-z0-9][a-z0-9._/-]*$/.test(name)) {
      throw new Error(`${dir}/package.json has no usable name`);
    }
    return name;
  });
}
