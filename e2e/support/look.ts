// One look at a screen in both themes (slice A-01-10 checkpoint 4, "Screens" row): axe in light
// and dark, and, when `E2E_SHOTS` names a folder, a screenshot of each for the owner's comparison
// with the approved drawings. Secrets on screen (a one-time link, a TOTP key, recovery codes) are
// masked in every screenshot: `mask` names them, and the known places are always added. Nothing
// is written without `E2E_SHOTS`; CI does not set it.
import { mkdirSync } from 'node:fs';
import { join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Locator, Page } from '@playwright/test';
import { expectPageAxeClean } from './axe.ts';

// By component slot, so a reworded label or another page's CopyField stays masked (security
// review L1). The TOTP key has no slot of its own yet: its `bdi translate="no"`.
const SECRETS = [
  '[data-slot="copy-field-value"]',
  '[data-slot="qr-code"]',
  '[data-slot="code-list"]',
  '[data-slot="code-list-print"]',
  'bdi[translate="no"]',
];
const REPO = resolve(fileURLToPath(new URL('../../', import.meta.url)));

async function shot(page: Page, name: string, mask: Locator[]): Promise<void> {
  const folder = process.env['E2E_SHOTS'];
  if (!folder) return;
  // Never inside the repository, which is public (security review L2).
  const dir = resolve(folder);
  if (dir === REPO || dir.startsWith(`${REPO}${sep}`)) {
    throw new Error('E2E_SHOTS must name a folder outside the repository');
  }
  mkdirSync(dir, { recursive: true });
  const always = SECRETS.map((selector) => page.locator(selector));
  await page.screenshot({
    path: join(dir, `${name}.png`),
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
