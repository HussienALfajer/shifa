// One look at a screen in both themes (slice A-01-10 checkpoint 4, "Screens" row): axe in light
// and dark, and, when `E2E_SHOTS` names a folder, a screenshot of each for the owner's comparison
// with the approved drawings. Secrets on screen (a one-time link, a TOTP key, recovery codes) are
// masked in every screenshot: `mask` names them, and the known places are always added. Nothing
// is written without `E2E_SHOTS`; CI does not set it.
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { Locator, Page } from '@playwright/test';
import { expectPageAxeClean } from './axe.ts';

const SECRETS = [
  '[data-testid="link-shown"] input',
  '[data-testid="link-shown"] textarea',
  '[data-slot="code-list"]',
  'bdi[translate="no"]',
  '[role="img"][aria-label*="QR"]',
];

async function shot(page: Page, name: string, mask: Locator[]): Promise<void> {
  const folder = process.env['E2E_SHOTS'];
  if (!folder) return;
  mkdirSync(folder, { recursive: true });
  const always = SECRETS.map((selector) => page.locator(selector));
  await page.screenshot({
    path: join(folder, `${name}.png`),
    fullPage: true,
    animations: 'disabled',
    mask: [...always, ...mask],
  });
}

/** axe clean in light and in dark; a masked screenshot of each when `E2E_SHOTS` is set. */
export async function look(page: Page, name: string, mask: Locator[] = []): Promise<void> {
  await expectPageAxeClean(page, `${name} (light)`);
  await shot(page, `${name}-light`, mask);
  await page.emulateMedia({ colorScheme: 'dark' });
  await expectPageAxeClean(page, `${name} (dark)`);
  await shot(page, `${name}-dark`, mask);
  await page.emulateMedia({ colorScheme: 'light' });
}
