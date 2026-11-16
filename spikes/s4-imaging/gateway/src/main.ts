// Gateway process: configuration from the environment (set by the stack harness per run), the
// gateway on PORT (all interfaces of its two networks) and counters on 127.0.0.1:METRICS_PORT
// (reachable only from inside the container).
import { createServer } from 'node:http';
import { createAuditLog } from './audit.ts';
import { buildServer, type Upstream } from './server.ts';

const required = (name: string): string => {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
};

const audit = createAuditLog(required('S4_DATABASE_URL'));
const { app, metrics } = buildServer({
  tokenKey: Buffer.from(required('S4_TOKEN_KEY'), 'base64'),
  upstreams: JSON.parse(required('S4_UPSTREAMS')) as Record<string, Upstream>,
  audit,
  // The largest generated instance is the 300 MB single-file CBCT; STOW sends it in one part.
  maxStowBytes: Number(process.env['S4_MAX_STOW_BYTES'] ?? 400_000_000),
});

await app.listen({ host: '0.0.0.0', port: Number(process.env['PORT'] ?? 8080) });
createServer((_req, res) => {
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify(metrics));
}).listen(Number(process.env['METRICS_PORT'] ?? 9091), '127.0.0.1');

const shutdown = () => {
  void app.close().then(() => audit.close());
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
