// Criteria 6 and 8: two devices offline together for 2 simulated hours, then reconnect.
import { expect, test } from '@playwright/test';
import { Device } from '../harness/device.ts';
import { assertOutcome, ensureSession, outageScript } from '../harness/script.ts';
import { recordSummary } from '../harness/summary.ts';
import { toxi } from '../harness/toxi.ts';

test('two devices, two hours offline, nothing lost or duplicated', async ({ browser }) => {
  const a = await Device.open(browser, 'dev-a');
  const b = await Device.open(browser, 'dev-b');
  await a.login();
  await b.login();
  const opened = await ensureSession([a, b]);

  await toxi.cut('dev-a');
  await toxi.cut('dev-b');
  const expected = await outageScript([a, b], '09:00');

  for (const d of [a, b]) {
    await expect(d.page.getByTestId('banner')).toHaveAttribute('data-state', 'offline');
    expect(await d.offlineSeconds(), 'banner shows the time offline').toBeGreaterThanOrEqual(
      // The banner counts from the first failed contact, which comes one 90 s step after the cut.
      2 * 3600 - 180,
    );
    expect(await d.pending()).toBe(d.queued);
  }

  await toxi.restore('dev-a');
  await toxi.restore('dev-b');
  await a.waitSynced();
  await b.waitSynced();
  // A second round lets each device pull the other's rows.
  await a.waitSynced();

  const outcome = await assertOutcome([a, b], expected, opened);
  await recordSummary(test.info(), 'two-hours-offline', { expected, outcome });
});
