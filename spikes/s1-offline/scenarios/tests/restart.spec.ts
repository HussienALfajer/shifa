// Edge case "tab closed / browser restarted mid-outage": a persistent profile is closed while
// offline and reopened offline. Records which queued commands survive (report's eviction note).
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { type BrowserContext, chromium, expect, test } from '@playwright/test';
import { Device } from '../harness/device.ts';
import { serverReport, totals } from '../harness/report.ts';
import { ensureSession } from '../harness/script.ts';
import { recordSummary } from '../harness/summary.ts';
import { toxi } from '../harness/toxi.ts';

test('a browser restart mid-outage keeps the queue and opens offline', async () => {
  const profile = await mkdtemp(join(tmpdir(), 's1-restart-'));
  const opened: BrowserContext[] = [];
  const launch = async () => {
    const c = await chromium.launchPersistentContext(profile);
    opened.push(c);
    return c;
  };
  try {
    let context = await launch();
    let r = await Device.open(context, 'dev-r');
    await r.login();
    await ensureSession([r]);
    // Load once more so the service worker controls the page and caches the shell.
    await r.page.reload();
    await r.waitSynced();
    const id = await r.deviceId();
    const before = totals(await serverReport([id])).commands;

    await toxi.cut('dev-r');
    for (let n = 1; n <= 5; n += 1) await r.walkIn(n);
    for (let k = 1; k <= 3; k += 1) await r.sale('USD', `${String(k)}.00`);
    await context.close();

    context = await launch();
    r = await Device.open(context, 'dev-r');
    await expect(r.page.getByTestId('banner'), 'the app shell opens offline').toBeVisible();
    const survived = await r.pending();
    expect(survived, 'every queued command survived the restart').toBe(8);

    await toxi.restore('dev-r');
    await r.waitSynced();
    const synced = totals(await serverReport([id])).commands - before;
    expect(synced).toBe(8);
    await recordSummary(test.info(), 'restart', { queued: 8, survived, synced });
  } finally {
    for (const c of opened) await c.close().catch(() => undefined);
    // Windows keeps Chromium's log open briefly after close.
    await rm(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 500 });
  }
});
