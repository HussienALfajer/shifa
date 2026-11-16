// Criterion 1: from the clinic side (the browser container) no TCP connection reaches any
// Orthanc, PostgreSQL or Garage port, by service name or by IP; the gateway through the link
// does. Started without the ops tunnel, so nothing but the link leaves the clinic network.
import { chromium } from 'playwright';
import { describe, expect, it } from 'vitest';
import { docker, dockerJson } from '../src/docker.ts';
import { useStack } from './use-stack.ts';

const stack = useStack({ ops: false, browser: true });

// Runs in the browser container: tries each host:port for 3 s, prints what happened.
const PROBE = `
const net = require('node:net');
const targets = JSON.parse(process.argv[1]);
Promise.all(targets.map((t) => new Promise((resolve) => {
  const s = net.connect({ host: t.host, port: t.port, timeout: 3000 });
  s.on('connect', () => { s.destroy(); resolve({ ...t, result: 'open' }); });
  s.on('timeout', () => { s.destroy(); resolve({ ...t, result: 'timeout' }); });
  s.on('error', (e) => resolve({ ...t, result: e.code || 'error' }));
}))).then((r) => console.log(JSON.stringify(r)));
`;

interface Target {
  host: string;
  port: number;
  result?: string;
}

async function probe(targets: Target[]): Promise<Target[]> {
  const browser = stack.browser?.container;
  if (!browser) throw new Error('browser container not started');
  const out = await docker(['exec', browser, 'node', '-e', PROBE, JSON.stringify(targets)]);
  return JSON.parse(out.stdout) as Target[];
}

async function ipOn(container: string, network: string): Promise<string> {
  const inspect = await dockerJson<
    { NetworkSettings: { Networks: Record<string, { IPAddress: string }> } }[]
  >(['inspect', container]);
  const ip = inspect[0]?.NetworkSettings.Networks[network]?.IPAddress;
  if (!ip) throw new Error(`${container} has no address on ${network}`);
  return ip;
}

describe('network boundary', () => {
  it('refuses every cloud-side port from the clinic network, by name and by IP', async () => {
    const services: [string, number[]][] = [
      ...Object.values(stack.tenants).map((t): [string, number[]] => [t.container, [8042, 4242]]),
      [stack.postgres.container, [5432]],
      [stack.garage.container, [3900, 3901, 3903]],
      [stack.gateway.container, [8080]],
    ];
    const targets: Target[] = [];
    for (const [container, ports] of services) {
      const ip = await ipOn(container, stack.networks.orthanc).catch(() => undefined);
      const cloudIp = await ipOn(container, stack.networks.cloud).catch(() => undefined);
      for (const port of ports) {
        targets.push({ host: container, port });
        for (const addr of [ip, cloudIp]) if (addr) targets.push({ host: addr, port });
      }
    }
    const results = await probe(targets);
    // 2 Orthancs × 2 ports × (name, IP) + PostgreSQL 2 + Garage 3 × 2 + gateway 3 = 19.
    expect(results.length).toBeGreaterThanOrEqual(19);
    expect(results.filter((r) => r.result === 'open')).toEqual([]);
  });

  it('reaches the gateway through the link', async () => {
    const browser = stack.browser?.container ?? '';
    const out = await docker([
      'exec',
      browser,
      'node',
      '-e',
      `fetch(process.argv[1]).then((r) => console.log(r.status))`,
      `${stack.clinicGatewayUrl}/healthz`,
    ]);
    expect(out.stdout.trim()).toBe('200');
  });

  it('drives the clinic-side browser over Playwright and loads the gateway through the link', async () => {
    const endpoint = stack.browser?.wsEndpoint;
    if (!endpoint) throw new Error('browser container not started');
    const browser = await chromium.connect(endpoint);
    try {
      const page = await browser.newPage();
      const res = await page.goto(`${stack.clinicGatewayUrl}/healthz`);
      expect(res?.status()).toBe(200);
    } finally {
      await browser.close();
    }
  });
});
