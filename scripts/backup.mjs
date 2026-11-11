#!/usr/bin/env node
// `pnpm backup:up | down | reset --yes | full | diff | check | restore | drill`: the local
// backup stack (infra/backup, docs/process/backup-restore.md). The logic is in lib/backup*.mjs;
// this file only connects it to the real file system and child processes (lib/stack-io.mjs).
import { join } from 'node:path';
import { backupCommand } from './lib/backup.mjs';
import { createStackIo } from './lib/stack-io.mjs';

const io = createStackIo(join(import.meta.dirname, '..'), 'backup');

process.exitCode = await backupCommand(process.argv.slice(2), io);
