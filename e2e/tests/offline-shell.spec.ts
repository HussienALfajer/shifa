// Slice A-01-06 (ADR-0010): the one journey with the service worker on. Once it is installed,
// clinic web's shell loads with the network off; the API stays unreachable (never cached).
import { expect, test } from '@playwright/test';
import { urls } from '../support/run.ts';

test.use({ serviceWorkers: 'allow' });

test('the shell loads from the service worker when offline', async ({ page, context }) => {
  await page.goto(`${urls().clinic}/about`);
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'حول التطبيق' })).toBeVisible();
  const api = await page.evaluate(async () => {
    try {
      return (await fetch('/api/health/live')).status;
    } catch {
      return 'offline';
    }
  });
  expect(api).toBe('offline');
});
