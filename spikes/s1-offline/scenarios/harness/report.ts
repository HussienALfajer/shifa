// Reads the server's counts-only report for the given device ids (direct, not through a proxy).
import type { Report } from '@shifa-spike/s1-server';

export async function serverReport(devices: string[], username = 'reception-a'): Promise<Report> {
  const base = process.env['S1_SERVER_URL'];
  if (!base) throw new Error('S1_SERVER_URL missing: run through the scenario global setup');
  const login = await fetch(`${base}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username }),
  });
  const { token } = (await login.json()) as { token: string };
  const res = await fetch(`${base}/report?devices=${devices.join(',')}`, {
    headers: { authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`report: ${String(res.status)}`);
  return (await res.json()) as Report;
}

/** Sum of every device's command counts. */
export function totals(report: Report) {
  const all = Object.values(report.byDevice);
  const sum = (k: keyof (typeof all)[number]) => all.reduce((s, d) => s + d[k], 0);
  return {
    commands: sum('commands'),
    applied: sum('applied'),
    conflict: sum('conflict'),
    refused: sum('refused'),
    remaps: sum('remaps'),
  };
}
