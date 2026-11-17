// A queue worker process: configuration as JSON in S5_WORKER_CONFIG (set by spawn.ts; it holds
// per-run keys, so it is never logged), logs as JSON lines on stdout, a "worker_ready" line
// once pg-boss is working, SIGTERM for a graceful stop.
import type { MessagingConfig } from './config.ts';
import { createMessaging } from './service.ts';

type Serialised = Omit<MessagingConfig, 'allowlist'> & { allowlist: string[] };
const raw = process.env['S5_WORKER_CONFIG'];
if (!raw) throw new Error('S5_WORKER_CONFIG is not set');
// The config holds per-run keys: keep it out of the environment of any child process.
delete process.env['S5_WORKER_CONFIG'];
const parsed = JSON.parse(raw) as Serialised;
const messaging = await createMessaging({
  ...parsed,
  allowlist: new Set(parsed.allowlist),
  queue: 'worker',
});
process.stdout.write(`${JSON.stringify({ event: 'worker_ready' })}\n`);
process.on('SIGTERM', () => {
  void messaging.close().then(() => process.exit(0));
});
