#!/usr/bin/env node
// `pnpm obs:up | obs:down | obs:reset --yes | obs:smoke`: the local observability stack
// (infra/observability, docs/process/observability.md). The logic is in lib/obs.mjs; this file
// only connects it to the real file system and child processes (lib/stack-io.mjs).
import { join } from 'node:path';
import { obs } from './lib/obs.mjs';
import { createStackIo } from './lib/stack-io.mjs';

const io = createStackIo(join(import.meta.dirname, '..'), 'obs');

process.exitCode = await obs(process.argv.slice(2), io);
