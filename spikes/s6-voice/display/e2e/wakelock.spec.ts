// Criterion 8 (VOX-17): Wake Lock on start and again after the page is hidden and shown. The API
// is stubbed: headless Chromium refuses a real screen lock (a limit recorded for the emulator run).
import { expect, type Page, test } from '@playwright/test';
import { openDisplay, state } from './helpers.ts';

async function stubWakeLock(page: Page, mode: 'grant' | 'deny'): Promise<void> {
  await page.addInitScript((m) => {
    const w = window as unknown as { __wl: { requests: number; sentinels: EventTarget[] } };
    w.__wl = { requests: 0, sentinels: [] };
    let hidden = false;
    Object.defineProperty(document, 'visibilityState', {
      get: () => (hidden ? 'hidden' : 'visible'),
    });
    Object.defineProperty(document, 'hidden', { get: () => hidden });
    (window as unknown as { __setHidden: (h: boolean) => void }).__setHidden = (h) => {
      hidden = h;
      if (h) {
        // The browser releases a screen lock when the page is hidden.
        for (const s of w.__wl.sentinels.splice(0)) {
          (s as unknown as { released: boolean }).released = true;
          s.dispatchEvent(new Event('release'));
        }
      }
      document.dispatchEvent(new Event('visibilitychange'));
    };
    Object.defineProperty(navigator, 'wakeLock', {
      value: {
        request: (type: string) => {
          w.__wl.requests += 1;
          if (m === 'deny' || type !== 'screen') {
            return Promise.reject(new DOMException('denied', 'NotAllowedError'));
          }
          const sentinel = Object.assign(new EventTarget(), {
            released: false,
            type,
            release: () => Promise.resolve(),
          });
          w.__wl.sentinels.push(sentinel);
          return Promise.resolve(sentinel);
        },
      },
    });
  }, mode);
}

const requests = (page: Page) =>
  page.evaluate(() => (window as unknown as { __wl: { requests: number } }).__wl.requests);
const setHidden = (page: Page, hidden: boolean) =>
  page.evaluate((h) => {
    (window as unknown as { __setHidden: (x: boolean) => void }).__setHidden(h);
  }, hidden);

test('requests a screen lock on start and again after hidden → visible', async ({ page }) => {
  await stubWakeLock(page, 'grant');
  await openDisplay(page);
  await expect.poll(() => requests(page)).toBe(1);
  expect((await state(page)).wakeLock.held).toBe(true);

  await setHidden(page, true);
  await expect.poll(async () => (await state(page)).wakeLock.held).toBe(false);
  await setHidden(page, false);
  await expect.poll(() => requests(page)).toBe(2);
  await expect.poll(async () => (await state(page)).wakeLock.held).toBe(true);
  await expect(page.getByTestId('status')).toContainText('Wake Lock');
});

test('a refused lock is shown in the status line', async ({ page }) => {
  await stubWakeLock(page, 'deny');
  await openDisplay(page);
  await expect.poll(async () => (await state(page)).wakeLock.error).toBe('NotAllowedError');
  await expect(page.getByTestId('status')).toContainText('NotAllowedError');
});
