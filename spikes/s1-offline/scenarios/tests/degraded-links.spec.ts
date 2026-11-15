// Criterion 7: the same script, reconnecting over a degraded link (2 s latency, 30% of connections
// reset) with the first upload's response cut after the server applied it: no duplicates.
import { expect, test } from '@playwright/test';
import { Device } from '../harness/device.ts';
import { serverReport, totals } from '../harness/report.ts';
import { assertOutcome, ensureSession, outageScript } from '../harness/script.ts';
import { recordSummary } from '../harness/summary.ts';
import { toxi } from '../harness/toxi.ts';

test('degraded link and a cut mid-upload never duplicate a command', async ({ browser }) => {
  test.setTimeout(20 * 60_000);
  const a = await Device.open(browser, 'dev-a');
  const b = await Device.open(browser, 'dev-b');
  await a.login();
  await b.login();
  const opened = await ensureSession([a, b]);

  await toxi.cut('dev-a');
  await toxi.cut('dev-b');
  const expected = await outageScript([a, b], '11:00');

  // dev-a: the server receives the first batch but the response never arrives.
  await toxi.cutResponses('dev-a');
  await toxi.restore('dev-a');
  const idA = await a.deviceId();
  await expect
    .poll(
      async () => {
        await a.advance(4_000);
        return (await serverReport([idA])).byDevice[idA]?.commands ?? 0;
      },
      { timeout: 60_000 },
    )
    .toBeGreaterThan(0);
  expect(await a.pending(), 'the device still holds the batch the server applied').toBeGreaterThan(
    0,
  );
  await toxi.clear('dev-a');

  for (const name of ['dev-a', 'dev-b'] as const) await toxi.degrade(name);
  await toxi.restore('dev-b');
  await a.waitSynced(10 * 60_000);
  await b.waitSynced(10 * 60_000);
  await a.waitSynced(10 * 60_000);
  for (const name of ['dev-a', 'dev-b'] as const) await toxi.clear(name);

  const outcome = await assertOutcome([a, b], expected, opened);
  await recordSummary(test.info(), 'degraded-links', {
    expected,
    outcome,
    totals: totals(outcome.report),
  });
});
