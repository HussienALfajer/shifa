// Slice A-02-10 checkpoint 4: what A-02 changes in clinic web, through the real screens of both
// apps against the built API and a real database (A-02 criteria 4, 11–13, 15 as the clinic sees
// them; the spec's three Playwright journeys). In order, each building on the last: (1) the owner
// of a solo clinic is refused a second doctor at 1 of 1, the seventh seeded super admin raises the
// limit with an override on admin web, and the owner then adds the doctor; (2) support access
// opened on admin web reads clinic web as the owner under the support banner, a write drawn
// disabled, the owner sees the warning banner and ends it, and the support tab shows «انتهى دخول
// الدعم» with the owner's name; (3) an announcement for this clinic is seen and hidden by the
// owner, and stays hidden on a second device. Every screen on the way is axe clean in light and
// dark (`look()`); with `E2E_SHOTS` set, each is also captured for the drawings.
import {
  type Browser,
  type BrowserContext,
  devices,
  expect,
  type Page,
  test,
} from '@playwright/test';
import type { ClinicCreated, MyAnnouncements, TotpEnrolStart } from '@shifa/contracts';
import { createRandom, fullName, generatePersonName, generatePhone } from '@shifa/testing';
import { look } from '../support/look.ts';
import { callInPage, consumeSetupLink, expectCall } from '../support/page.ts';
import { seeded, urls } from '../support/run.ts';
import { passChallenge, signInThroughScreen } from '../support/screens.ts';
import { nextCode } from '../support/totp.ts';

const PASSWORD = 'جملة-سرية-لرحلة-عيادة-الويب';
// Its own seed, so no phone is shared with another spec (seed.ts 2026_11_24 … tabs 2026_11_30).
const random = createRandom(2026_12_01);
const person = () =>
  fullName(generatePersonName(random, { sex: 'female', adult: true, region: 'aleppo' }));

test.describe.configure({ mode: 'serial' });
// Each enrolment or challenge waits at most one 30-second TOTP step.
test.setTimeout(150_000);

const contexts: BrowserContext[] = [];
async function personPage(browser: Browser): Promise<Page> {
  const context = await browser.newContext({
    ...devices['Desktop Chrome'],
    viewport: { width: 1440, height: 1000 },
    locale: 'ar-SY',
    serviceWorkers: 'block',
  });
  contexts.push(context);
  return context.newPage();
}
test.afterAll(async () => {
  for (const context of contexts.splice(0)) await context.close();
});

const clinic = { name: 'عيادة الحدود والدعم', id: '' };
const owner = { phone: generatePhone(random, 'SY'), name: person(), key: '' };
const REASON = 'المالك لا يرى الطبيب الجديد في قائمة الفريق';
const NOTICE = 'صيانة قصيرة الليلة من 11 إلى 12. احفظوا عملكم قبلها.';
let admin: Page;
let ownerPage: Page;

/** Sets a person up through the API only; answers the TOTP key for later challenges. */
async function enrolThroughApi(page: Page, base: string, token: string): Promise<string> {
  await page.goto(`${base}/sign-in`);
  await consumeSetupLink(page, token, PASSWORD);
  const start = await expectCall<TotpEnrolStart>(page, 200, 'POST', '/auth/mfa/enrol/start');
  await expectCall(page, 200, 'POST', '/auth/mfa/enrol/confirm', {
    code: await nextCode(start.manualKey),
  });
  return start.manualKey;
}

test('(1) the owner is refused at 1 of 1 doctors; an override raises it; the doctor is added', async ({
  browser,
}) => {
  const clinicWeb = urls().clinic;
  admin = await personPage(browser);
  await enrolThroughApi(admin, urls().admin, seeded().clinicWebAdmin.token);
  const created = await expectCall<ClinicCreated>(admin, 201, 'POST', '/platform/clinics', {
    name: clinic.name,
    type: 'solo',
    status: 'active',
    ownerName: owner.name,
    ownerPhone: owner.phone,
  });
  clinic.id = created.clinic.id;
  ownerPage = await personPage(browser);
  owner.key = await enrolThroughApi(
    ownerPage,
    clinicWeb,
    new URL(created.ownerLink.url).hash.slice(1),
  );
  // The solo plan's one doctor, added through the API: the limit is now full.
  await expectCall(ownerPage, 201, 'POST', '/team/members', {
    name: person(),
    phone: generatePhone(random, 'SY'),
    roles: [{ role: 'doctor', branchId: null }],
  });
  const refused = await callInPage(ownerPage, 'POST', '/team/members', {
    name: person(),
    phone: generatePhone(random, 'SY'),
    roles: [{ role: 'doctor', branchId: null }],
  });
  expect(refused.status).toBe(409);

  await ownerPage.goto(`${clinicWeb}/team`);
  await expect(ownerPage.getByRole('heading', { name: 'الفريق', level: 1 })).toBeVisible();
  // A solo clinic has no «الفروع» in its navigation: the plan allows one branch.
  await expect(ownerPage.getByRole('navigation').getByRole('link', { name: 'الفروع' })).toHaveCount(
    0,
  );
  await ownerPage.getByRole('button', { name: 'إضافة موظف' }).first().click();
  const drawer = ownerPage.getByRole('dialog', { name: 'إضافة موظف' });
  const doctorRole = drawer.getByTestId('role-doctor').getByRole('checkbox', { name: 'طبيب' });
  await expect(doctorRole).toBeDisabled();
  await expect(drawer.getByText('الحد ممتلئ: 1 من 1')).toBeVisible();
  await expect(drawer.getByText(/وصلت العيادة إلى حد الأطباء في خطتها \(1 من 1\)/)).toBeVisible();
  await look(ownerPage, 'a02c-team-at-limit');
  await drawer.getByRole('button', { name: 'إغلاق' }).first().click();

  // The super admin raises the doctors' limit on admin web.
  await admin.goto(`${urls().admin}/clinics/${clinic.id}`);
  await admin.getByRole('tab', { name: 'الاشتراك والحدود', exact: true }).click();
  const doctors = admin.locator('[data-row]', { hasText: 'limits.practitioners' });
  await doctors.getByRole('button', { name: 'تجاوز' }).click();
  const override = admin.getByRole('dialog', { name: 'تجاوز حد الأطباء' });
  await override.getByLabel('القيمة', { exact: true }).fill('2');
  await override.getByRole('textbox', { name: 'السبب' }).fill('طبيب ثانٍ لعيادة المساء');
  await override.getByRole('button', { name: 'حفظ التجاوز' }).click();
  await expect(override).toBeHidden();
  await expect(doctors.locator('[data-effective]')).toHaveText('2');

  // The owner, on a fresh page, adds the second doctor.
  const doctor = { name: person(), phone: generatePhone(random, 'SY') };
  await ownerPage.goto(`${clinicWeb}/team`);
  await ownerPage.getByRole('button', { name: 'إضافة موظف' }).first().click();
  const again = ownerPage.getByRole('dialog', { name: 'إضافة موظف' });
  await expect(again.getByText('1 من 2')).toBeVisible();
  await again.getByLabel('الاسم', { exact: true }).fill(doctor.name);
  await again.getByLabel('رقم الهاتف', { exact: true }).fill(doctor.phone);
  await again.getByTestId('role-doctor').getByRole('checkbox', { name: 'طبيب' }).check();
  await again.getByRole('button', { name: 'إضافة وإصدار الرابط' }).click();
  await expect(ownerPage.getByRole('dialog', { name: doctor.name })).toBeVisible();
});

test('(2) support access reads clinic web as the owner, read-only, until the owner ends it', async () => {
  const clinicWeb = urls().clinic;
  await admin.goto(`${urls().admin}/clinics/${clinic.id}`);
  await admin.getByRole('tab', { name: 'دخول الدعم', exact: true }).click();
  await admin.getByRole('textbox', { name: 'السبب' }).fill(REASON);
  const opened = admin.context().waitForEvent('page');
  await admin.getByRole('button', { name: 'فتح الدخول' }).click();
  const tab = await opened;
  // Booleans only: a failed match would print the hand-off.
  await expect
    .poll(() => new URL(tab.url()).pathname === '/' && new URL(tab.url()).hash === '', {
      message: 'the hand-off opened clinic web home and left the address',
    })
    .toBe(true);
  const strip = tab.getByRole('region', { name: 'دخول الدعم' });
  await expect(strip).toContainText('دخول الدعم · للقراءة فقط');
  await expect(strip).toContainText(clinic.name);
  await expect(strip).toContainText(REASON);
  await expect(strip).toContainText(/متبقٍّ (60|59) دقيقة/);
  await look(tab, 'a02c-support-home');

  await tab.goto(`${clinicWeb}/team`);
  await expect(tab.getByRole('heading', { name: 'الفريق', level: 1 })).toBeVisible();
  await expect(tab.getByRole('button', { name: 'إضافة موظف' }).first()).toBeDisabled();
  await expect(tab.getByText('للقراءة فقط').first()).toBeVisible();
  await look(tab, 'a02c-support-team');
  // The server refuses a write all the same (403 `support_read_only`).
  const write = await callInPage(tab, 'PATCH', '/clinic/settings', { idleMinutes: 30 });
  expect(write.status).toBe(403);

  // The owner sees who reads the clinic, why, and ends it.
  await ownerPage.goto(`${clinicWeb}/settings`);
  const banner = ownerPage.getByRole('region', { name: 'دخول الدعم' });
  await expect(banner).toContainText('من فريق شفاء تقرأ عيادتك الآن، للقراءة فقط.');
  await expect(banner).toContainText(REASON);
  await expect(ownerPage.getByRole('grid', { name: 'سجل دخول الدعم' })).toContainText(REASON);
  await expect(ownerPage.getByText('الاشتراك', { exact: true })).toBeVisible();
  await look(ownerPage, 'a02c-settings-banner');
  await banner.getByRole('button', { name: 'إنهاء الدخول' }).click();
  await ownerPage.getByRole('alertdialog').getByRole('button', { name: 'إنهاء الدخول' }).click();
  await expect(ownerPage.getByText('أنهيت دخول الدعم')).toBeVisible();
  await expect(banner).toHaveCount(0);
  await expect(ownerPage.getByRole('grid', { name: 'سجل دخول الدعم' })).toContainText('أنهيته أنت');
  await look(ownerPage, 'a02c-settings-ended');

  // The support tab's next request answers 401 `support_ended`: the ended page, with the owner.
  await tab.reload();
  await expect(tab.getByRole('heading', { name: 'انتهى دخول الدعم', level: 1 })).toBeVisible();
  await expect(tab.getByText(`أنهاه مالك العيادة ${owner.name}`)).toBeVisible();
  await look(tab, 'a02c-support-ended');
  await tab.close();
});

test('(3) an announcement is seen and hidden, and stays hidden on a second device', async ({
  browser,
}) => {
  const clinicWeb = urls().clinic;
  await expectCall(admin, 201, 'POST', '/platform/announcements', {
    body: NOTICE,
    level: 'warning',
    startsAt: new Date(Date.now() - 60_000).toISOString(),
    target: 'selected',
    clinicIds: [clinic.id],
  });
  await ownerPage.goto(`${clinicWeb}/`);
  const strip = ownerPage.getByRole('region', { name: 'إعلان من شفاء' });
  await expect(strip).toContainText('تنبيه:');
  await expect(strip).toContainText(NOTICE);
  await look(ownerPage, 'a02c-announcement');
  await strip.getByRole('button', { name: 'إخفاء الإعلان' }).click();
  await expect(strip).toHaveCount(0);

  const second = await personPage(browser);
  await signInThroughScreen(second, clinicWeb, owner.phone, PASSWORD);
  await passChallenge(second, owner.key);
  await expect(second.getByRole('heading', { name: 'الرئيسية', level: 1 })).toBeVisible();
  const mine = await expectCall<MyAnnouncements>(second, 200, 'GET', '/me/announcements');
  expect(mine.announcements).toEqual([]);
  await expect(second.getByRole('region', { name: 'إعلان من شفاء' })).toHaveCount(0);
});
