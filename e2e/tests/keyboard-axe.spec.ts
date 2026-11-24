// Slice A-01-07 checkpoint 5 ("Screens" row): the third seeded owner walks the entry path by
// keyboard only (Tab, typing, Enter, Space; no pointer), and axe checks every screen on the way
// in light, and sign-in and the challenge in dark too. The chooser's keyboard path and axe run in
// entry-path.spec.ts (3), where a person holds two clinics.
import { expect, type Page, test } from '@playwright/test';
import { expectPageAxeClean } from '../support/axe.ts';
import { seeded, urls } from '../support/run.ts';
import { tabTo } from '../support/screens.ts';
import { nextCode } from '../support/totp.ts';

const PASSWORD = 'جملة-سرية-للوحة-المفاتيح';

test.setTimeout(120_000);

async function axeBoth(page: Page, what: string): Promise<void> {
  await expectPageAxeClean(page, `${what} (light)`);
  await page.emulateMedia({ colorScheme: 'dark' });
  await expectPageAxeClean(page, `${what} (dark)`);
  await page.emulateMedia({ colorScheme: 'light' });
}

test('setup, enrolment, codes, sign-in and challenge by keyboard, axe clean', async ({ page }) => {
  const base = urls().clinic;
  const owner = seeded().clinics[2]?.owner;
  if (!owner) throw new Error('no third seeded clinic');

  await page.goto(`${base}/setup#${owner.token}`);
  await expect(page.getByLabel('كلمة مرور جديدة', { exact: true })).toBeVisible();
  await expectPageAxeClean(page, 'setup link');
  await tabTo(page, page.getByLabel('كلمة مرور جديدة', { exact: true }));
  await page.keyboard.type(PASSWORD);
  await tabTo(page, page.getByLabel('أعد كتابة كلمة المرور', { exact: true }));
  await page.keyboard.type(PASSWORD);
  await page.keyboard.press('Enter');

  await expect(page.getByRole('heading', { name: 'ثبّت تطبيق المصادقة' })).toBeVisible();
  await expectPageAxeClean(page, 'enrolment step 1');
  await tabTo(page, page.getByRole('button', { name: 'لديّ التطبيق، التالي' }));
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'امسح الرمز بالتطبيق' })).toBeVisible();
  const key = (await page.locator('bdi[translate="no"]').innerText()).replace(/\s+/g, '');
  await expectPageAxeClean(page, 'enrolment step 2');
  await tabTo(page, page.getByRole('button', { name: 'أضفت الحساب، التالي' }));
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'اكتب الرمز من التطبيق' })).toBeVisible();
  await expectPageAxeClean(page, 'enrolment step 3');
  await tabTo(page, page.locator('input[inputmode="numeric"]'));
  await page.keyboard.type(await nextCode(key));

  await expect(page.getByRole('heading', { name: 'احفظ رموز الاسترداد' })).toBeVisible();
  await expectPageAxeClean(page, 'recovery codes');
  await tabTo(page, page.getByRole('checkbox', { name: /حفظتُ الرموز/ }));
  await page.keyboard.press('Space');
  await tabTo(page, page.getByRole('button', { name: 'متابعة إلى العيادة' }));
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(`${base}/`);
  await tabTo(page, page.getByRole('button', { name: 'تسجيل الخروج' }), 30);
  await page.keyboard.press('Enter');

  await expect(page).toHaveURL(`${base}/sign-in?reason=signed_out`);
  await expect(page.getByTestId('sign-in-reason')).toBeVisible();
  await axeBoth(page, 'sign-in with the signed-out notice');
  await tabTo(page, page.getByLabel('رقم الهاتف', { exact: true }));
  await page.keyboard.type(owner.phone);
  await tabTo(page, page.getByLabel('كلمة المرور', { exact: true }));
  await page.keyboard.type('ليست-كلمة-المرور');
  await page.keyboard.press('Enter');
  // One message for a wrong phone or password, under the password field.
  await expect(page.getByLabel('كلمة المرور', { exact: true })).toHaveAttribute(
    'aria-invalid',
    'true',
  );
  await expect(page.getByText('رقم الهاتف أو كلمة المرور غير صحيحة').first()).toBeVisible();
  await axeBoth(page, 'sign-in, wrong password');
  await page.getByLabel('كلمة المرور', { exact: true }).focus();
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.type(PASSWORD);
  await page.keyboard.press('Enter');

  await expect(page.getByRole('heading', { name: 'رمز التحقق' })).toBeVisible();
  await axeBoth(page, 'challenge');
  await tabTo(page, page.getByRole('button', { name: 'استخدام رمز استرداد' }));
  await page.keyboard.press('Enter');
  await expect(page.getByLabel('رمز الاسترداد', { exact: true })).toBeVisible();
  await expectPageAxeClean(page, 'challenge, recovery-code mode');
  await tabTo(page, page.getByRole('button', { name: 'استخدام رمز التطبيق' }));
  await page.keyboard.press('Enter');
  await tabTo(page, page.locator('input[inputmode="numeric"]'));
  await page.keyboard.type(await nextCode(key));
  await expect(page).toHaveURL(`${base}/`);
});
