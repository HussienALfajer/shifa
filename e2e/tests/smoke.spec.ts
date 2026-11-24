// Slice A-01-06: the smoke journeys against the built API, a real database and the built apps
// (A-01a and A-01b, "Flows"). (a) signed out → sign-in on both apps; (b) the super admin sets the
// password through the setup-link API and signs in: admin web shows enrolment; (c) a session
// that ran out sends the next request to sign-in with the reason; (d) each app refuses the
// other's people.
import { expect, test } from '@playwright/test';
import { consumeSetupLink, expireSession, sessionOf, signInInPage } from '../support/page.ts';
import { seeded, urls } from '../support/run.ts';

const PASSWORD = 'كلمة-مرور-تجريبية-طويلة';

test.describe.configure({ mode: 'serial' });

test('(a) signed out, / on each app goes to /sign-in', async ({ page }) => {
  for (const base of [urls().clinic, urls().admin]) {
    await page.goto(`${base}/`);
    await expect(page).toHaveURL(`${base}/sign-in`);
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
    await expect(page.getByRole('heading', { name: 'تسجيل الدخول' })).toBeVisible();
  }
});

test('(b) the super admin sets the password, signs in, and is sent to enrolment', async ({
  page,
  context,
}) => {
  const { superAdmin } = seeded();
  await page.goto(`${urls().admin}/sign-in`);
  await consumeSetupLink(page, superAdmin.token, PASSWORD);
  await context.clearCookies();
  const view = await signInInPage(page, superAdmin.phone, PASSWORD);
  expect(view.platformAdmin).toBe(true);
  const cookies = await context.cookies();
  expect(cookies.map((c) => c.name)).toContain('__Host-shifa.sid');

  await page.goto(`${urls().admin}/`);
  // A super admin owes enrolment (A-01-07 checkpoint 3): the first of its three steps.
  await expect(page).toHaveURL(`${urls().admin}/mfa`);
  await expect(page.getByRole('heading', { name: 'ثبّت تطبيق المصادقة' })).toBeVisible();
  await expect(page.getByText('حساب مشرف شفاء يحتاج رمزاً من هاتفك')).toBeVisible();
});

test('(c) a session that ran out sends the next request to sign-in with the reason', async ({
  page,
}) => {
  const owner = seeded().clinics[0]?.owner;
  if (!owner) throw new Error('no seeded clinic');
  await page.goto(`${urls().clinic}/sign-in`);
  await consumeSetupLink(page, owner.token, PASSWORD);
  await page.goto(`${urls().clinic}/about`);
  await expect(page.getByTestId('signed-in')).toBeVisible();

  // Mid-session: the next request the open page makes answers 401 session_expired.
  await expireSession((await sessionOf(page)).sessionId);
  await page.evaluate(() => {
    document.dispatchEvent(new Event('visibilitychange'));
    window.dispatchEvent(new Event('focus'));
  });
  // The server names why (A-01-09): the session's last activity is past its idle limit.
  await expect(page).toHaveURL(`${urls().clinic}/sign-in?reason=idle`);
  await expect(page.getByTestId('sign-in-reason')).toHaveAttribute('data-reason', 'idle');
  await expect(page.getByTestId('sign-in-reason')).toContainText('خرجت تلقائياً');
});

test('(d) clinic web refuses to be admin web, and the reverse', async ({ page, context }) => {
  const { superAdmin } = seeded();
  await page.goto(`${urls().clinic}/sign-in`);
  await signInInPage(page, superAdmin.phone, PASSWORD);
  await page.goto(`${urls().clinic}/`);
  await expect(page).toHaveURL(`${urls().clinic}/admin-web`);

  const owner = seeded().clinics[1]?.owner;
  if (!owner) throw new Error('no second seeded clinic');
  await context.clearCookies();
  await page.goto(`${urls().admin}/sign-in`);
  await consumeSetupLink(page, owner.token, PASSWORD);
  await page.goto(`${urls().admin}/`);
  await expect(page).toHaveURL(`${urls().admin}/sign-in?reason=not_admin`);
  expect((await context.cookies()).map((c) => c.name)).not.toContain('__Host-shifa.sid');
});
