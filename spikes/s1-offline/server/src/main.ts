// Standalone spike server (owner's manual run, CI scenario job). Configuration from the
// environment; the database URL is for the application role and is never logged.
//   S1_APP_DATABASE_URL  postgres://shifa_app:...@host:5432/shifa (required)
//   S1_PORT (4310) · S1_HOST (0.0.0.0) · S1_TOKEN_TTL_SECONDS (900) · S1_STATIC_DIR (optional)
import { createDb } from '@shifa/db';
import { buildServer } from './app.ts';
import { syntheticIdentities } from './identities.ts';
import { stdoutSink } from './log.ts';

const url = process.env['S1_APP_DATABASE_URL'];
if (!url) throw new Error('S1_APP_DATABASE_URL is required');
const db = createDb(url);
const app = await buildServer({
  db,
  identities: syntheticIdentities(),
  tokenTtlSeconds: Number(process.env['S1_TOKEN_TTL_SECONDS'] ?? '900'),
  log: stdoutSink,
  ...(process.env['S1_STATIC_DIR'] ? { staticDir: process.env['S1_STATIC_DIR'] } : {}),
});
app.addHook('onClose', () => db.close());
await app.listen({
  port: Number(process.env['S1_PORT'] ?? '4310'),
  host: process.env['S1_HOST'] ?? '0.0.0.0',
});
stdoutSink({ event: 'listening' });
