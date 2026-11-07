#!/usr/bin/env node
// Enforces the byte budgets for Claude Code instruction files
// (docs/process/development-workflow.md §8). Exits 1 when any file is over budget.

import { readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const root = join(import.meta.dirname, '..');
const KB = 1024;
const SKIP = new Set(['node_modules', '.git', '.turbo', 'dist', 'coverage', '.verify']);
// Top-level docs/ holds documentation, not instructions; nested docs/ folders are still checked.
const SKIP_TOP = new Set(['docs']);

/** @returns {number | undefined} budget in bytes, or undefined if the file has none */
function budgetFor(rel) {
  const parts = rel.split(sep);
  const name = parts.at(-1);
  if (rel === 'CLAUDE.md') return 8 * KB;
  // Every other CLAUDE.md (packages, tooling, .claude/CLAUDE.md) gets the per-package budget.
  if (name === 'CLAUDE.md' || name === 'CLAUDE.local.md') return 4 * KB;
  if (parts[0] === '.claude' && parts[1] === 'rules' && name?.endsWith('.md')) return 3 * KB;
  if (parts[0] === '.claude' && parts[1] === 'skills' && name === 'SKILL.md') return 4 * KB;
  return undefined;
}

function* walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(entry.name)) continue;
    if (dir === root && SKIP_TOP.has(entry.name)) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else yield full;
  }
}

let over = 0;
let checked = 0;
for (const file of walk(root)) {
  const rel = relative(root, file);
  const budget = budgetFor(rel);
  if (budget === undefined) continue;
  checked += 1;
  const size = statSync(file).size;
  if (size > budget) {
    over += 1;
    process.stdout.write(`over budget: ${rel} is ${size} bytes (limit ${budget})\n`);
  }
}
process.stdout.write(`instruction files checked: ${checked}, over budget: ${over}\n`);
process.exitCode = over ? 1 : 0;
