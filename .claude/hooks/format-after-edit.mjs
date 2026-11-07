#!/usr/bin/env node
// PostToolUse (Edit|Write|MultiEdit): formats the edited file. Never blocks; a formatter error
// is reported to Claude as context, and `verify` will catch anything left unformatted.
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { extname, join } from 'node:path';
import { projectDir, readEvent } from './lib/io.mjs';

const event = await readEvent();
const filePath = event.tool_input?.file_path;
if (!filePath || !existsSync(filePath)) process.exit(0);

const root = projectDir(event);
const ext = extname(filePath).toLowerCase();
const BIOME = new Set([
  '.js',
  '.mjs',
  '.cjs',
  '.ts',
  '.tsx',
  '.mts',
  '.cts',
  '.json',
  '.jsonc',
  '.css',
]);

let result;
if (BIOME.has(ext)) {
  const biome = join(root, 'node_modules', '@biomejs', 'biome', 'bin', 'biome');
  if (!existsSync(biome)) process.exit(0);
  result = spawnSync(process.execPath, [biome, 'format', '--write', filePath], {
    cwd: root,
    encoding: 'utf8',
  });
} else if (ext === '.dart') {
  result = spawnSync('dart', ['format', filePath], { cwd: root, encoding: 'utf8', shell: true });
} else {
  process.exit(0);
}

if (result.status !== 0) {
  process.stderr.write(
    `Formatter could not format ${filePath}:\n${result.stderr || result.stdout}`,
  );
}
process.exit(0);
