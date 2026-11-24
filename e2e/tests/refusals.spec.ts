// Slice A-01-07 checkpoint 5, review 1 and 5: the refusals of the entry path on the real backend
// that the journeys do not reach. (a) A setup link leaves no token in the browser's history, and a
// used link shows one message without the clinic's name (A-01a criterion 4); (b) a phone with no
// account gets the same one message as a wrong password (criterion 6), and the fifth wrong attempt
// locks the phone with a countdown, the form off (criterion 7). Independent of the other files:
// the fourth seeded clinic, and a synthetic phone no one holds.
import { expect, test } from '@playwright/test';
import { createRandom, generatePhone } from '@shifa/testing';
import { consumeSetupLink } from '../support/page.ts';
import { seeded, urls } from '../support/run.ts';
import { fragmentGone, openSecretLink } from '../support/screens.ts';

const PASSWORD = 'جملة-سرية-لرحلة-الرفض';
const CLINIC = 'عيادة الرحلات الرابعة';
const INVALID = 'هذا الرابط لم يعد صالحاً';
const WRONG = 'رقم الهاتف أو كلمة المرور غير صحيحة';

test.describe.configure({ mode: 'serial' });

test('(a) no token in the history; a used link names no clinic', async ({ page, context }) => {
  const owner = seeded().clinics[3]?.owner;
  if (!owner) throw new Error('no fourth seeded clinic');
  const link = `${urls().clinic}/setup#${owner.token}`;

  await openSecretLink(page, link);
  await expect(page.getByRole('heading', { name: `إعداد حسابك في ${CLINIC}` })).toBeVisible();
  // Back to the page before, then forward again: the entry the link made holds no fragment
  // (replaceState, not pushState). Booleans only, so a failure never prints the token.
  await page.goBack();
  expect(fragmentGone(page), 'no token on the page before').toBe(true);
  await page.goForward();
  expect(new URL(page.url()).pathname).toBe('/setup');
  expect(fragmentGone(page), 'no token in the link’s own entry').toBe(true);
  // Without its fragment the page has no token to show: the invalid-link message (backlog I3).
  await expect(page.getByRole('heading', { name: INVALID })).toBeVisible();

  // The link used (as the owner would by setting the password), then opened again.
  await consumeSetupLink(page, owner.token, PASSWORD);
  await context.clearCookies();
  await openSecretLink(page, link);
  await expect(page.getByRole('heading', { name: INVALID })).toBeVisible();
  await expect(page.getByText('استُخدم من قبل، أو انتهت مدته')).toBeVisible();
  await expect(page.locator('main')).not.toContainText(CLINIC);
  await expect(page.getByLabel('كلمة مرور جديدة', { exact: true })).toHaveCount(0);
});

test('(b) an unknown phone: the one message, then the phone lock with its countdown', async ({
  page,
}) => {
  const phone = generatePhone(createRandom(2026_11_27), 'SY');
  await page.goto(`${urls().clinic}/sign-in`);
  const phoneField = page.getByLabel('رقم الهاتف', { exact: true });
  const password = page.getByLabel('كلمة المرور', { exact: true });
  const submit = page.getByRole('button', { name: 'دخول', exact: true });
  await phoneField.fill(phone);
  await password.fill(PASSWORD);
  await submit.click();
  await expect(page.getByText(WRONG).first()).toBeVisible();
  await expect(password).toHaveAttribute('aria-invalid', 'true');

  // Four more (five failures in 15 minutes); the answer after the lock is phone_locked.
  const lock = page.getByTestId('sign-in-error');
  // Each attempt waits for its own answer (the status line of the last one is still shown).
  for (let attempt = 0; attempt < 5; attempt++) {
    await expect(password).toBeEnabled();
    await password.fill(PASSWORD);
    const [answer] = await Promise.all([
      page.waitForResponse((r) => new URL(r.url()).pathname === '/api/auth/sign-in'),
      submit.click(),
    ]);
    if (answer.status() === 429) break;
    expect(answer.status()).toBe(401);
  }
  await expect(lock).toHaveAttribute('data-code', 'phone_locked');
  await expect(lock).toContainText('توقّف الدخول بهذا الرقم مؤقتاً');
  await expect(lock).toContainText(/يمكنك المحاولة بعد/);
  await expect(submit).toBeDisabled();
  // The password does not stay in the field through a lock (checkpoint 2 security review L3).
  await expect(password).toHaveValue('');
});
