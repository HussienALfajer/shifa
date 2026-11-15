// Criterion 9: an outage longer than the token's life loses nothing and syncs nothing until the
// receptionist logs in again; then everything syncs once. dev-x talks to the short-TTL server.
import { expect, test } from '@playwright/test';
import { Device } from '../harness/device.ts';
import { serverReport, totals } from '../harness/report.ts';
import { SHORT_TTL_SECONDS } from '../harness/stack.ts';
import { recordSummary } from '../harness/summary.ts';
import { toxi } from '../harness/toxi.ts';

test('an expired token keeps the queue until re-login, then syncs once', async ({ browser }) => {
  const x = await Device.open(browser, 'dev-x');
  await x.login();
  await x.waitSynced();
  const id = await x.deviceId();
  const before = totals(await serverReport([id])).commands;

  await toxi.cut('dev-x');
  for (let n = 1; n <= 10; n += 1) {
    await x.walkIn(n);
    await x.advance(60_000);
  }
  // Outlive the token in real time (the server checks expiry on its own clock).
  await x.page.waitForTimeout((SHORT_TTL_SECONDS + 5) * 1000);
  await toxi.restore('dev-x');

  await expect
    .poll(
      async () => {
        await x.advance(4_000);
        return x.state();
      },
      { timeout: 60_000 },
    )
    .toBe('needs-login');
  expect(await x.pending(), 'queue kept').toBe(10);
  expect(totals(await serverReport([id])).commands, 'nothing synced without a login').toBe(before);

  await x.page.getByTestId('relogin').click();
  await x.waitSynced();
  const after = await serverReport([id]);
  expect(totals(after).commands - before, 'each queued command synced exactly once').toBe(10);
  expect(totals(after).applied - before).toBe(10);
  await recordSummary(test.info(), 'session-expiry', {
    queued: 10,
    synced: totals(after).commands - before,
  });
});
