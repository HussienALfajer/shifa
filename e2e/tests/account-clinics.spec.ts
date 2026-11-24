// Slice A-01-10 checkpoint 4: My account, the clinic's automatic sign-out and admin web's clinics
// through the real screens, against the built API, a real database and the built apps (A-01a
// "Flows" and "Screens"; criteria 3, 4, 10, 10a, 10b, 12a, 13 as a person sees them). In order,
// each journey building on the last: (1) the third seeded super admin enrols, creates a clinic on
// admin web and copies the owner's link; the owner opens it, sets the password and enrols; (2) the
// owner changes the password on My account and the other device is signed out; (3) the owner
// renews the recovery codes and an old one is refused; (4) the owner sets 15 minutes and a second
// member's next request reads it; (5) the super admin resets the owner's MFA and the owner enrols
// again. Every screen on the way is axe clean in light and dark (`look()`); with `E2E_SHOTS` set,
// each is also captured, secrets masked, for the comparison with the approved drawings.
import {
  type Browser,
  type BrowserContext,
  devices,
  expect,
  type Page,
  test,
} from '@playwright/test';
import type { MemberAdded } from '@shifa/contracts';
import { createRandom, fullName, generatePersonName, generatePhone } from '@shifa/testing';
import { look } from '../support/look.ts';
import { callInPage, expectCall, sessionOf } from '../support/page.ts';
import { seeded, urls } from '../support/run.ts';
import {
  enrolThroughScreens,
  passChallenge,
  setPasswordFromLink,
  signInThroughScreen,
} from '../support/screens.ts';
import { nextCode } from '../support/totp.ts';

const PASSWORD = 'جملة-سرية-لرحلة-الحساب';
const NEW_PASSWORD = 'جملة-أخرى-بعد-التغيير';
// Each spec draws from its own seed, so no phone is shared: seed.ts 2026_11_24, entry-path
// 2026_11_26, refusals 2026_11_27 (its phone must stay unknown), this file 2026_11_28.
const random = createRandom(2026_11_28);
const person = () =>
  fullName(generatePersonName(random, { sex: 'female', adult: true, region: 'aleppo' }));

test.describe.configure({ mode: 'serial' });
// Each journey waits at most one 30-second TOTP step per fresh code.
test.setTimeout(150_000);

const contexts: BrowserContext[] = [];
async function personPage(browser: Browser, phone = false): Promise<Page> {
  const context = await browser.newContext({
    ...(phone ? devices['Pixel 7'] : devices['Desktop Chrome']),
    locale: 'ar-SY',
    serviceWorkers: 'block',
  });
  contexts.push(context);
  return context.newPage();
}
test.afterAll(async () => {
  for (const context of contexts.splice(0)) await context.close();
});

const clinic = { name: 'عيادة حسابي', id: '' };
const owner = {
  phone: generatePhone(random, 'SY'),
  name: person(),
  key: '',
  codes: [] as string[],
};
let admin: Page;
let ownerPage: Page;

/** Signs out from the app frame («خروج»); lands on sign-in with `reason=signed_out`. */
async function signOutFromFrame(page: Page, base: string): Promise<void> {
  await page.getByRole('button', { name: 'خروج', exact: true }).click();
  await expect(page).toHaveURL(`${base}/sign-in?reason=signed_out`);
}

test('(1) the super admin creates a clinic on admin web; its owner sets up from the copied link', async ({
  browser,
}) => {
  const base = urls().admin;
  admin = await personPage(browser);
  await admin.context().grantPermissions(['clipboard-read', 'clipboard-write'], { origin: base });
  const { accountAdmin } = seeded();
  await setPasswordFromLink(
    admin,
    `${base}/setup#${accountAdmin.token}`,
    PASSWORD,
    'حفظ والمتابعة إلى التحقق',
  );
  await enrolThroughScreens(admin, 'متابعة إلى إدارة شفاء');
  await expect(admin).toHaveURL(`${base}/`);
  await expect(admin.getByRole('heading', { name: 'العيادات', level: 1 })).toBeVisible();
  await look(admin, 'admin-clinics');

  await admin.getByRole('link', { name: 'إنشاء عيادة' }).click();
  await expect(admin).toHaveURL(`${base}/clinics/new`);
  // Refused before sending: every field is named.
  await admin.getByRole('button', { name: 'إنشاء العيادة' }).click();
  await expect(admin.getByText('اكتب اسم العيادة')).toBeVisible();
  await expect(admin.getByText('اكتب هاتف المالك')).toBeVisible();
  await look(admin, 'admin-create-refused');
  await admin.getByLabel('اسم العيادة', { exact: true }).fill(clinic.name);
  await admin.getByRole('radio', { name: 'فعّالة' }).check();
  await admin.getByLabel('اسم المالك', { exact: true }).fill(owner.name);
  await admin.getByLabel('هاتف المالك', { exact: true }).fill(owner.phone);
  await admin.getByRole('button', { name: 'إنشاء العيادة' }).click();

  await expect(admin.getByRole('heading', { name: 'أُنشئت العيادة' })).toBeVisible();
  const shown = admin.getByTestId('link-shown');
  await expect(shown.getByLabel('رابط الإعداد')).toBeVisible();
  await look(admin, 'admin-created-link');
  await shown.getByRole('button', { name: 'نسخ' }).click();
  await expect(shown.getByRole('button', { name: 'نُسخ' })).toBeVisible();
  const url = await admin.evaluate(() => navigator.clipboard.readText());
  // Booleans only: a failed match would print the link.
  expect(url.startsWith(`${urls().clinic}/setup#`), 'the copied link is a setup link').toBe(true);
  // Copied: leaving asks nothing.
  await admin.getByRole('button', { name: 'فتح صفحة العيادة' }).click();
  await expect(admin.getByRole('heading', { name: clinic.name, level: 1 })).toBeVisible();
  clinic.id = new URL(admin.url()).pathname.split('/').pop() ?? '';
  await expect(admin.getByTestId('owner-card')).toContainText('بانتظار الإعداد');
  await look(admin, 'admin-clinic-pending');

  ownerPage = await personPage(browser);
  await setPasswordFromLink(ownerPage, url, PASSWORD, 'حفظ والمتابعة إلى التحقق');
  const enrolled = await enrolThroughScreens(ownerPage, 'متابعة إلى العيادة');
  owner.key = enrolled.key;
  owner.codes = enrolled.codes;
  await expect(ownerPage).toHaveURL(`${urls().clinic}/`);
  expect(await sessionOf(ownerPage)).toMatchObject({ tenantId: clinic.id, mfa: 'verified' });

  await admin.reload();
  await expect(admin.getByTestId('owner-card')).toContainText('أكمل الإعداد');
});

test('(2) the owner changes the password on My account; the other device is signed out', async ({
  browser,
}) => {
  const base = urls().clinic;
  const other = await personPage(browser, true);
  await signInThroughScreen(other, base, owner.phone, PASSWORD);
  await passChallenge(other, owner.key);
  await expect(other).toHaveURL(`${base}/`);

  await ownerPage.goto(`${base}/account`);
  await expect(ownerPage.getByRole('heading', { name: 'حسابي', level: 1 })).toBeVisible();
  await expect(ownerPage.getByTestId('session-row')).toHaveCount(2);
  await expect(ownerPage.getByTestId('session-row').first()).toContainText('هذا الجهاز');
  await look(ownerPage, 'account-two-devices');
  await look(other, 'home-phone');

  await ownerPage.getByRole('button', { name: 'تغيير كلمة المرور' }).click();
  const dialog = ownerPage.getByRole('dialog', { name: 'تغيير كلمة المرور' });
  await dialog.getByLabel('كلمة المرور الحالية', { exact: true }).fill('ليست-كلمة-المرور-الحالية');
  await dialog.getByLabel('كلمة المرور الجديدة', { exact: true }).fill(NEW_PASSWORD);
  await dialog.getByLabel('أعد كتابة كلمة المرور الجديدة', { exact: true }).fill(NEW_PASSWORD);
  await dialog.getByRole('button', { name: 'حفظ كلمة المرور' }).click();
  // 401 `invalid_credentials` is a field error, never a sign-out.
  await expect(dialog.getByText('كلمة المرور الحالية غير صحيحة.')).toBeVisible();
  await look(ownerPage, 'account-password-wrong-current');
  await dialog.getByLabel('كلمة المرور الحالية', { exact: true }).fill(PASSWORD);
  await dialog.getByRole('button', { name: 'حفظ كلمة المرور' }).click();
  await expect(dialog).toBeHidden();
  await expect(ownerPage.getByText('أخرجنا أجهزتك الأخرى (1)', { exact: false })).toBeVisible();
  await expect(ownerPage.getByTestId('session-row')).toHaveCount(1);
  await look(ownerPage, 'account-password-changed');

  // This device stays in; the other one's next request is refused and it lands on sign-in.
  expect((await sessionOf(ownerPage)).tenantId).toBe(clinic.id);
  expect((await callInPage(other, 'GET', '/auth/session')).status).toBe(401);
  await other.goto(`${base}/`);
  await expect(other).toHaveURL(new RegExp(`${base}/sign-in`));
});

test('(3) the owner renews the recovery codes; an old code is refused, a new one works', async () => {
  const base = urls().clinic;
  const [usedCode, oldCode] = owner.codes;
  if (usedCode === undefined || oldCode === undefined) throw new Error('no recovery codes kept');
  // One code used first, so the renewal's «10» is a count read again, not the one before.
  await signOutFromFrame(ownerPage, base);
  await signInThroughScreen(ownerPage, base, owner.phone, NEW_PASSWORD);
  await ownerPage.getByRole('button', { name: 'استخدام رمز استرداد' }).click();
  await ownerPage.getByLabel('رمز الاسترداد', { exact: true }).fill(usedCode);
  await ownerPage.getByRole('button', { name: 'تأكيد' }).click();
  await expect(ownerPage).toHaveURL(`${base}/`);
  await ownerPage.goto(`${base}/account`);
  const card = ownerPage.getByTestId('mfa-card');
  await expect(card.getByTestId('codes-left')).toContainText('بقيت 9 رموز');
  await card.getByRole('button', { name: 'رموز استرداد جديدة' }).click();
  const dialog = ownerPage.getByRole('dialog', { name: 'رموز استرداد جديدة' });
  await look(ownerPage, 'account-codes-ask');
  await dialog.locator('input[inputmode="numeric"]').fill(await nextCode(owner.key));
  const list = dialog.getByRole('list', { name: 'رموز الاسترداد العشرة' });
  await expect(list).toBeVisible();
  const fresh = await list.locator('[data-slot="code"]').allInnerTexts();
  expect(fresh.length, 'ten new codes are shown').toBe(10);
  expect(
    fresh.some((code) => owner.codes.includes(code)),
    'the new codes are new',
  ).toBe(false);
  await look(ownerPage, 'account-codes-once');
  const done = dialog.getByRole('button', { name: 'تم' });
  await expect(done).toBeDisabled();
  await dialog.getByRole('checkbox', { name: /حفظتُ الرموز/ }).check();
  await done.click();
  await expect(ownerPage.getByText('رموز جديدة جاهزة')).toBeVisible();
  await expect(card.getByTestId('codes-left')).toContainText('بقيت 10 رموز');

  await signOutFromFrame(ownerPage, base);
  await signInThroughScreen(ownerPage, base, owner.phone, NEW_PASSWORD);
  await ownerPage.getByRole('button', { name: 'استخدام رمز استرداد' }).click();
  await ownerPage.getByLabel('رمز الاسترداد', { exact: true }).fill(oldCode);
  await ownerPage.getByRole('button', { name: 'تأكيد' }).click();
  await expect(ownerPage.getByText('رمز الاسترداد غير صحيح أو استُعمل من قبل.')).toBeVisible();
  await expect(ownerPage).toHaveURL(`${base}/mfa`);
  await ownerPage.getByLabel('رمز الاسترداد', { exact: true }).fill(fresh[0] ?? '');
  await ownerPage.getByRole('button', { name: 'تأكيد' }).click();
  await expect(ownerPage).toHaveURL(`${base}/`);
  await expect(ownerPage.getByTestId('codes-left')).toContainText('بقي لديك 9 رموز');
});

test('(4) the owner sets 15 minutes; a second member reads it on the next request', async ({
  browser,
}) => {
  const base = urls().clinic;
  const added = await expectCall<MemberAdded>(ownerPage, 201, 'POST', '/team/members', {
    name: person(),
    phone: generatePhone(random, 'SY'),
    roles: [{ role: 'doctor', branchId: null }],
  });
  const member = await personPage(browser);
  await setPasswordFromLink(member, added.link.url, PASSWORD, 'حفظ والدخول');
  await expect(member).toHaveURL(`${base}/`);
  expect((await sessionOf(member)).idleMinutes).toBe(30);
  // Only the owner has «إعدادات العيادة».
  await member.goto(`${base}/account`);
  await expect(member.getByRole('heading', { name: 'حسابي', level: 1 })).toBeVisible();
  await expect(member.getByRole('link', { name: 'إعدادات العيادة' })).toHaveCount(0);
  await look(member, 'account-member-no-mfa');

  // The owner reaches it from the menu: the item exists for the owner alone.
  await ownerPage.goto(`${base}/account`);
  await ownerPage.getByRole('link', { name: 'إعدادات العيادة' }).click();
  await expect(ownerPage).toHaveURL(`${base}/settings`);
  await expect(ownerPage.getByRole('heading', { name: 'إعدادات العيادة', level: 1 })).toBeVisible();
  const save = ownerPage.getByRole('button', { name: 'حفظ', exact: true });
  // «حفظ» waits for a change (improvement c).
  await expect(save).toBeDisabled();
  await ownerPage.getByRole('radio', { name: /15 دقيقة/ }).check();
  await save.click();
  await expect(ownerPage.getByTestId('settings-note')).toContainText('حُفظ: 15 دقيقة');
  await look(ownerPage, 'settings-saved');

  expect((await sessionOf(member)).idleMinutes).toBe(15);
});

test('(5) the super admin resets the owner’s MFA; the owner is signed out and enrols again', async () => {
  const base = urls().clinic;
  await admin.goto(`${urls().admin}/`);
  await admin.getByLabel('بحث باسم العيادة').fill(clinic.name);
  await admin.getByRole('link', { name: clinic.name }).click();
  await expect(admin).toHaveURL(`${urls().admin}/clinics/${clinic.id}`);
  const card = admin.getByTestId('owner-card');
  await expect(card).toContainText('أكمل الإعداد');
  await look(admin, 'admin-clinic-active');
  await card.getByRole('button', { name: 'إعادة ضبط التحقق بخطوتين' }).click();
  const confirm = admin.getByRole('alertdialog', { name: 'إعادة ضبط التحقق بخطوتين للمالك؟' });
  await look(admin, 'admin-reset-mfa-confirm');
  await confirm.getByRole('button', { name: 'إعادة الضبط' }).click();
  await expect(card.getByText('أُعيد ضبط التحقق بخطوتين')).toBeVisible();

  // Every session of the owner ended: the next request is refused.
  expect((await callInPage(ownerPage, 'GET', '/auth/session')).status).toBe(401);
  await signInThroughScreen(ownerPage, base, owner.phone, NEW_PASSWORD);
  await expect(ownerPage).toHaveURL(`${base}/mfa`);
  const again = await enrolThroughScreens(ownerPage, 'متابعة إلى العيادة');
  expect(again.key !== owner.key, 'a new key').toBe(true);
  await expect(ownerPage).toHaveURL(`${base}/`);
  expect(await sessionOf(ownerPage)).toMatchObject({ tenantId: clinic.id, mfa: 'verified' });
});
