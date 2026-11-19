// `pnpm start` in this package: the spike receiver on 127.0.0.1 (port S7_RECEIVER_PORT, default
// 8787), state in spikes/s7-push/.out/. The emulator reaches it at http://10.0.2.2:<port>.
import { join } from 'node:path';
import { startServer } from './server.ts';

const dir = process.env['S7_OUT_DIR'] ?? join(import.meta.dirname, '..', '..', '.out');
const port = Number(process.env['S7_RECEIVER_PORT'] ?? '8787');
const server = await startServer({ dir, port });
process.stdout.write(`s7 receiver listening on ${server.url} (state in ${dir})\n`);

const stop = () => {
  void server.close().then(() => process.exit(0));
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
