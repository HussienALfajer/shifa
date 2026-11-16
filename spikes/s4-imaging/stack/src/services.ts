// Small helper services of the stack: the link test's byte sink and the ops tunnel config.

// Byte sink behind the link (link tests): counts uploads, serves downloads, answers pings.
export const SINK = `
require('node:http').createServer((req, res) => {
  const url = new URL(req.url, 'http://sink');
  if (url.pathname === '/upload') {
    let bytes = 0;
    req.on('data', (c) => { bytes += c.length; });
    req.on('end', () => res.end(JSON.stringify({ bytes })));
  } else if (url.pathname === '/download') {
    const total = Number(url.searchParams.get('bytes'));
    const chunk = Buffer.alloc(65536, 7);
    res.setHeader('content-length', String(total));
    let sent = 0;
    const pump = () => {
      while (sent < total) {
        const n = Math.min(chunk.length, total - sent);
        sent += n;
        if (!res.write(n === chunk.length ? chunk : chunk.subarray(0, n))) return res.once('drain', pump);
      }
      res.end();
    };
    pump();
  } else res.end('ok');
}).listen(9000);
`;

// Test access to the cloud side (ops): Orthanc REST, Garage S3 and PostgreSQL, 127.0.0.1 only.
export const opsConfig = () => `global
  maxconn 1024
resolvers docker
  nameserver dns 127.0.0.11:53
  hold valid 1s
defaults
  mode tcp
  timeout connect 10s
  timeout client 1h
  timeout server 1h
${[
  ['orthanc-a', 8042, 18042],
  ['orthanc-b', 8042, 18043],
  ['garage', 3900, 13900],
  ['postgres', 5432, 15432],
]
  .map(
    ([host, port, local]) => `frontend f-${String(host)}
  bind :${String(local)}
  default_backend b-${String(host)}
backend b-${String(host)}
  server s ${String(host)}:${String(port)} resolvers docker init-addr last,libc,none`,
  )
  .join('\n')}
`;
