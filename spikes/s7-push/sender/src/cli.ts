// CLI: node src/cli.ts send --kind <reminder|turn-near|call-in|sync> --appointment <id>
//   --to <installId|all> [--at <iso>] [--count n] [--no-collapse] [--ttl-to <iso>]
// Prints one line per send (s7id, install, status); the token and key never appear.
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { KINDS, type Kind, openReceiver } from '@shifa-spike/s7-receiver';
import { createTokenProvider } from './auth.ts';
import { loadConfig } from './env.ts';
import { createSender, type SendRequest } from './send.ts';

const USAGE =
  'usage: send --kind <reminder|turn-near|call-in|sync> --appointment <id> --to <installId|all> ' +
  '[--at <iso>] [--count n] [--no-collapse] [--ttl-to <iso>]';

function isKind(value: string): value is Kind {
  return (KINDS as readonly string[]).includes(value);
}

function parseDate(name: string, value: string): Date {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error(`--${name} must be an ISO time`);
  return date;
}

export function parseSendArgs(argv: string[], now = new Date()): SendRequest {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      kind: { type: 'string' },
      appointment: { type: 'string' },
      to: { type: 'string' },
      at: { type: 'string' },
      count: { type: 'string' },
      'no-collapse': { type: 'boolean' },
      'ttl-to': { type: 'string' },
    },
  });
  if (positionals[0] !== 'send') throw new Error(USAGE);
  const { kind, appointment, to } = values;
  if (!kind || !isKind(kind) || !appointment || !to) throw new Error(USAGE);
  const count = Number(values.count ?? '1');
  if (!Number.isInteger(count) || count < 1 || count > 500)
    throw new Error('--count must be 1..500');
  return {
    kind,
    appointmentId: appointment,
    // A synthetic appointment two hours from now unless --at names one.
    appointmentAt: values.at ? parseDate('at', values.at) : new Date(now.getTime() + 2 * 3600_000),
    to,
    count,
    collapse: !values['no-collapse'],
    ...(values['ttl-to'] ? { ttlTo: parseDate('ttl-to', values['ttl-to']) } : {}),
  };
}

async function main() {
  const request = parseSendArgs(process.argv.slice(2));
  const config = loadConfig();
  const tokens = createTokenProvider({
    serviceAccount: config.serviceAccount,
    tokenUrl: config.tokenUrl,
    log: (line) => process.stderr.write(`${line}\n`),
  });
  const sender = createSender({
    receiver: openReceiver(config.outDir),
    fcmBaseUrl: config.fcmBaseUrl,
    projectId: config.serviceAccount.project_id,
    getToken: tokens.getToken,
    logDir: join(config.outDir, 'logs'),
  });
  for (const line of await sender.send(request)) {
    const result = line.error ?? line.fcmName ?? '';
    process.stdout.write(
      `${line.s7id} ${line.installId} ${line.label} ${String(line.httpStatus)} ${result}\n`,
    );
  }
}

if (import.meta.main) {
  main().catch((e: unknown) => {
    process.stderr.write(`${e instanceof Error ? e.message : 'send failed'}\n`);
    process.exit(1);
  });
}
