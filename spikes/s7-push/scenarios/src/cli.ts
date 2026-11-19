// CLI (owner machine, 0.3-S7b checkpoints D–E):
//   node src/cli.ts run --state <name> --serial <emulator> --install <installId>
//     [--app compliant|noshow] [--count n] [--gap-s n] [--settle-s n] [--runs <dir>]
//   node src/cli.ts devices   (installs the receiver knows, no tokens)
//   node src/cli.ts day --target <serial>=<installId> [--target ...] [--date YYYY-MM-DD]
//     [--runs <dir>]
// Sends through the 0.3-S7a sender (inbox record first, then FCM) with the key named in
// `.env.local`; writes one run directory per run under `spikes/s7-push/runs/`.
import { join } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { parseArgs } from 'node:util';
import { type InboxRecord, openReceiver } from '@shifa-spike/s7-receiver';
import { createSender, createTokenProvider, loadConfig } from '@shifa-spike/s7-sender';
import { systemAdb } from './adb.ts';
import { runDay } from './day.ts';
import { writeRun } from './run-files.ts';
import { type App, type BaseDeps, runState } from './runner.ts';
import { isStateName } from './states.ts';

const RUNS_DIR = join(import.meta.dirname, '..', '..', 'runs');
const USAGE =
  'usage: run --state <name> --serial <s> --install <id> [--app compliant|noshow] [--count n] ' +
  '[--gap-s n] [--settle-s n] | day --target <serial>=<installId> [...] [--date YYYY-MM-DD]';

function baseDeps(): BaseDeps {
  const config = loadConfig();
  const receiver = openReceiver(config.outDir);
  const tokens = createTokenProvider({
    serviceAccount: config.serviceAccount,
    tokenUrl: config.tokenUrl,
    log: (line) => process.stderr.write(`${line}\n`),
  });
  const sender = createSender({
    receiver,
    fcmBaseUrl: config.fcmBaseUrl,
    projectId: config.serviceAccount.project_id,
    getToken: tokens.getToken,
    logDir: join(config.outDir, 'logs'),
  });
  return {
    adb: systemAdb(),
    now: () => new Date(),
    hostNs: () => BigInt(Date.now()) * 1_000_000n + (process.hrtime.bigint() % 1_000_000n),
    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    log: (line) => process.stdout.write(`${line}\n`),
    send: sender.send,
    receiver: {
      receipts: () => receiver.receipts(),
      inbox: () => receiver.store.readAll<InboxRecord>('inbox'),
      device: async (installId) => {
        const d = (await receiver.devices()).find((x) => x.installId === installId);
        if (!d) return null;
        // Never the token itself: only its hash leaves the receiver's state/ folder.
        return {
          tokenHash: d.tokenHash,
          permission: d.permission,
          channels: d.channels,
          appVersion: d.appVersion,
          sdkInt: d.sdkInt,
          model: d.model,
          reportedAt: d.reportedAt,
        };
      },
    },
  };
}

const int = (name: string, v: string | undefined) => {
  if (v === undefined) return undefined;
  const n = Number(v);
  if (!Number.isInteger(n) || n < 1) throw new Error(`--${name} must be a positive integer`);
  return n;
};

async function main(argv: string[]) {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      state: { type: 'string' },
      serial: { type: 'string' },
      install: { type: 'string' },
      app: { type: 'string' },
      count: { type: 'string' },
      'gap-s': { type: 'string' },
      'settle-s': { type: 'string' },
      target: { type: 'string', multiple: true },
      date: { type: 'string' },
      runs: { type: 'string' },
    },
  });
  const runs = values.runs ?? RUNS_DIR;
  if (positionals[0] === 'devices') {
    // The installs the receiver knows, without tokens: pick `--install` from here.
    const receiver = openReceiver(loadConfig().outDir);
    for (const d of await receiver.devices()) {
      process.stdout.write(
        `${d.installId} sdk=${String(d.sdkInt)} model=${d.model} app=${d.appVersion} permission=${d.permission} appointments=${d.channels.appointments} token=${d.tokenHash} at=${d.reportedAt}\n`,
      );
    }
    return;
  }
  if (positionals[0] === 'run') {
    const { state, serial, install } = values;
    const appArg = values.app ?? 'compliant';
    if (!state || !isStateName(state) || !serial || !install) throw new Error(USAGE);
    if (appArg !== 'compliant' && appArg !== 'noshow')
      throw new Error('--app is compliant or noshow');
    const app: App = appArg;
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    try {
      const count = int('count', values.count);
      const gapS = int('gap-s', values['gap-s']);
      const settleS = int('settle-s', values['settle-s']);
      const record = await runState(
        {
          state,
          serial,
          app,
          installId: install,
          ...(count ? { count } : {}),
          ...(gapS ? { gapS } : {}),
          ...(settleS ? { settleS } : {}),
        },
        {
          ...baseDeps(),
          prompt: async (text) => {
            await rl.question(`${text} `);
          },
        },
      );
      process.stdout.write(`written ${await writeRun(runs, record)}\n`);
    } finally {
      rl.close();
    }
    return;
  }
  if (positionals[0] === 'day') {
    const targets = (values.target ?? []).map((t) => {
      const [serial, installId] = t.split('=');
      if (!serial || !installId) throw new Error('--target is <serial>=<installId>');
      return { serial, installId };
    });
    if (targets.length === 0) throw new Error(USAGE);
    const day = values.date ? new Date(`${values.date}T00:00:00`) : new Date();
    const { records, missed } = await runDay({ day, targets }, baseDeps());
    for (const r of records) process.stdout.write(`written ${await writeRun(runs, r)}\n`);
    process.stdout.write(`missed slots: ${String(missed.length)}\n`);
    return;
  }
  throw new Error(USAGE);
}

if (import.meta.main) {
  main(process.argv.slice(2)).catch((e: unknown) => {
    process.stderr.write(`${e instanceof Error ? e.message : 'run failed'}\n`);
    process.exit(1);
  });
}
