// What a person does on the entry-path screens (slice A-01-07), as the journeys repeat it: the
// setup link opened in the page, enrolment with the journey's own authenticator, sign-in, the
// challenge. Each step waits for what the person sees, never for a request.
import { expect, type Locator, type Page } from '@playwright/test';
import { nextCode } from './totp.ts';

/** Presses Tab until `target` has the focus (keyboard-only paths); fails after `max` presses. */
export async function tabTo(page: Page, target: Locator, max = 15): Promise<void> {
  for (let i = 0; i < max; i++) {
    if (await target.evaluate((el) => el === document.activeElement)) return;
    await page.keyboard.press('Tab');
  }
  await expect(target).toBeFocused();
}

/**
 * True when the page's address carries no fragment. Asserted as a boolean everywhere: a failed
 * `toHaveURL` would print the address, and with it the token it failed to remove.
 */
export const fragmentGone = (page: Page): boolean => new URL(page.url()).hash === '';

/**
 * Opens a link whose fragment is a one-time token, without the token reaching a failure message
 * (`page.goto` names its URL when it fails): the app's own origin first, then `location.assign`
 * in the page. Waits until the token has left the address (history.replaceState, at once).
 */
export async function openSecretLink(page: Page, url: string): Promise<void> {
  const link = new URL(url);
  await page.goto(`${link.origin}/sign-in`);
  await page.evaluate((target) => {
    window.location.assign(target);
  }, url);
  await expect
    .poll(() => new URL(page.url()).pathname === link.pathname && fragmentGone(page), {
      message: 'the token left the address',
    })
    .toBe(true);
}

/** Opens a setup link in the page and sets the password; `save` names the button. */
export async function setPasswordFromLink(
  page: Page,
  url: string,
  password: string,
  save: 'حفظ والمتابعة إلى التحقق' | 'حفظ والدخول',
): Promise<void> {
  await openSecretLink(page, url);
  await page.getByLabel('كلمة مرور جديدة', { exact: true }).fill(password);
  await page.getByLabel('أعد كتابة كلمة المرور', { exact: true }).fill(password);
  await page.getByRole('button', { name: save }).click();
}

export interface Enrolled {
  key: string;
  codes: string[];
}

/** The three enrolment steps with a code from the shown key, then the codes kept and confirmed. */
export async function enrolThroughScreens(
  page: Page,
  next: 'متابعة إلى العيادة' | 'متابعة إلى إدارة شفاء',
): Promise<Enrolled> {
  await expect(page.getByRole('heading', { name: 'ثبّت تطبيق المصادقة' })).toBeVisible();
  await page.getByRole('button', { name: 'لديّ التطبيق، التالي' }).click();
  await expect(page.getByRole('heading', { name: 'امسح الرمز بالتطبيق' })).toBeVisible();
  await expect(
    page.getByRole('img', { name: 'رمز QR لإضافة حساب شفاء إلى تطبيق المصادقة' }),
  ).toBeVisible();
  const key = (await page.locator('bdi[translate="no"]').innerText()).replace(/\s+/g, '');
  // Booleans only: a failed match would print the key.
  expect(/^[A-Z2-7]{32}$/.test(key), 'a 32-character base32 key is shown').toBe(true);
  await page.getByRole('button', { name: 'أضفت الحساب، التالي' }).click();
  await expect(page.getByRole('heading', { name: 'اكتب الرمز من التطبيق' })).toBeVisible();
  // A complete code sends itself (improvement d): no button press.
  await page.locator('input[inputmode="numeric"]').fill(await nextCode(key));

  await expect(page.getByRole('heading', { name: 'احفظ رموز الاسترداد' })).toBeVisible();
  const list = page.getByRole('list', { name: 'رموز الاسترداد العشرة' });
  const codes = await list.locator('[data-slot="code"]').allInnerTexts();
  expect(codes.length, 'ten recovery codes are shown').toBe(10);
  const onward = page.getByRole('button', { name: next });
  // «حفظتُ الرموز» is required before going on.
  await expect(onward).toBeDisabled();
  await page.getByRole('checkbox', { name: /حفظتُ الرموز/ }).check();
  await onward.click();
  return { key, codes };
}

/** Signs in on the sign-in screen of the page's app. */
export async function signInThroughScreen(
  page: Page,
  base: string,
  phone: string,
  password: string,
): Promise<void> {
  await page.goto(`${base}/sign-in`);
  await expect(page.getByRole('heading', { name: 'تسجيل الدخول' })).toBeVisible();
  await page.getByLabel('رقم الهاتف', { exact: true }).fill(phone);
  await page.getByLabel('كلمة المرور', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'دخول', exact: true }).click();
}

/** The challenge after sign-in, answered with the next code of `key`. */
export async function passChallenge(page: Page, key: string): Promise<void> {
  await expect(page.getByRole('heading', { name: 'رمز التحقق' })).toBeVisible();
  await page.locator('input[inputmode="numeric"]').fill(await nextCode(key));
}

/** «تسجيل الخروج» on the home placeholder; lands on sign-in with `reason=signed_out`. */
export async function signOutFromHome(page: Page, base: string): Promise<void> {
  await page.getByRole('button', { name: 'تسجيل الخروج' }).click();
  await expect(page).toHaveURL(`${base}/sign-in?reason=signed_out`);
}
