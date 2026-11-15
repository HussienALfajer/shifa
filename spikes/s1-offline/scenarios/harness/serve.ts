// Owner's manual run (criterion 12): PostgreSQL in Docker, the spike server on the LAN serving the
// prototype for ENGINE, no proxy (the owner turns Wi-Fi off). Press Enter to print the counts-only
// report for every device seen so far; Ctrl+C stops and removes the container.
//   ENGINE=outbox pnpm --filter @shifa-spike/s1-scenarios serve
import { networkInterfaces } from 'node:os';
import { createInterface } from 'node:readline';
import { createDb } from '@shifa/db';
import { buildServer, syntheticIdentities } from '@shifa-spike/s1-server';
import { Pool } from 'pg';
import { pinTestcontainersHelpers } from './images.ts';
import type { Engine } from './stack.ts';

pinTestcontainersHelpers();
const { buildPrototype, startPostgres } = await import('./stack.ts');
const engine = (process.env['ENGINE'] ?? 'outbox') as Engine;
const port = Number(process.env['S1_PORT'] ?? '4310');
const staticDir = buildPrototype(engine);
const { pg, urls } = await startPostgres();
const db = createDb(urls.app);
const app = await buildServer({
  db,
  identities: syntheticIdentities(),
  tokenTtlSeconds: 4 * 3600,
  log: () => undefined,
  staticDir,
});
await app.listen({ port, host: '0.0.0.0' });

const out = (line: string) => process.stdout.write(`${line}\n`);
out(`Engine: ${engine}. Open on each device:`);
for (const nets of Object.values(networkInterfaces())) {
  for (const net of nets ?? [])
    if (net.family === 'IPv4' && !net.internal) out(`  http://${net.address}:${String(port)}`);
}
out('Press Enter to print the report; Ctrl+C to stop.');

async function report(): Promise<void> {
  const pool = new Pool({ connectionString: urls.superuser, max: 1 });
  const { rows } = await pool.query<{ device_id: string }>(
    'SELECT DISTINCT device_id FROM s1.offline_command',
  );
  await pool.end();
  if (rows.length === 0) {
    out('No commands yet.');
    return;
  }
  const base = `http://127.0.0.1:${String(port)}`;
  const login = await fetch(`${base}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: 'reception-a' }),
  });
  const { token } = (await login.json()) as { token: string };
  const res = await fetch(`${base}/report?devices=${rows.map((r) => r.device_id).join(',')}`, {
    headers: { authorization: `Bearer ${token}` },
  });
  out(JSON.stringify(await res.json(), null, 2));
}

createInterface({ input: process.stdin }).on('line', () => void report());
process.on('SIGINT', () => {
  void (async () => {
    await app.close();
    await db.close();
    await pg.stop();
    process.exit(0);
  })();
});
