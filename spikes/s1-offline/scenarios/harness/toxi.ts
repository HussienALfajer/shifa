// Network cuts from inside a test: the Toxiproxy HTTP API (the stack runs in the setup process).
const api = () => {
  const url = process.env['S1_TOXI_API'];
  if (!url) throw new Error('S1_TOXI_API missing: run through the scenario global setup');
  return url;
};

async function call(path: string, method: string, body?: unknown): Promise<void> {
  const res = await fetch(`${api()}${path}`, {
    method,
    headers: { 'content-type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  if (!res.ok && res.status !== 404)
    throw new Error(`toxiproxy ${method} ${path}: ${String(res.status)}`);
}

export type ProxyName = 'dev-a' | 'dev-b' | 'dev-r' | 'dev-x';

/** The device's proxies: the API link and, with PowerSync, the sync-stream link (404 if absent). */
const links = (name: ProxyName) => [name, `${name}-ps`];

export const toxi = {
  async cut(name: ProxyName): Promise<void> {
    for (const link of links(name)) await call(`/proxies/${link}`, 'POST', { enabled: false });
  },
  async restore(name: ProxyName): Promise<void> {
    for (const link of links(name)) await call(`/proxies/${link}`, 'POST', { enabled: true });
  },
  /** Degraded link (criterion 7): 2 s latency each way and 30% of connections reset. */
  async degrade(name: ProxyName): Promise<void> {
    for (const link of links(name)) {
      await call(`/proxies/${link}/toxics`, 'POST', {
        name: 'latency',
        type: 'latency',
        stream: 'downstream',
        attributes: { latency: 2000, jitter: 0 },
      });
      await call(`/proxies/${link}/toxics`, 'POST', {
        name: 'loss',
        type: 'reset_peer',
        stream: 'upstream',
        toxicity: 0.3,
        attributes: { timeout: 50 },
      });
    }
  },
  /** The server gets the request but the response is cut after a few bytes (mid-upload cut). */
  cutResponses: (name: ProxyName) =>
    call(`/proxies/${name}/toxics`, 'POST', {
      name: 'cut-response',
      type: 'limit_data',
      stream: 'downstream',
      attributes: { bytes: 64 },
    }),
  async clear(name: ProxyName): Promise<void> {
    for (const link of links(name)) {
      for (const toxic of ['latency', 'loss', 'cut-response']) {
        await call(`/proxies/${link}/toxics/${toxic}`, 'DELETE');
      }
    }
  },
};

/** The page URL of a device; with PowerSync it carries the device's sync-stream proxy as `ps`. */
export function deviceUrl(name: ProxyName): string {
  const key = name.replace('-', '_').toUpperCase();
  const url = process.env[`S1_URL_${key}`];
  if (!url) throw new Error(`no proxy URL for ${name}`);
  const ps = process.env[`S1_PS_URL_${key}`];
  return ps ? `${url}/?ps=${encodeURIComponent(ps)}` : url;
}
