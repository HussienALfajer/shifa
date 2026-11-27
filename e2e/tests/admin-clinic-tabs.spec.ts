// Slice A-02-08 checkpoint 4: the clinic page tabs and the clinics list's usage columns through
// the real screens, against the built API, a real database and the built apps (A-02 criteria 1,
// 3, 9, 11, 17, 19–21 as the super admin sees them). In order, each building on the last: (1)
// the fifth seeded super admin enrols, creates a multi-branch clinic, checks every contract row
// of these screens with a real call, and an override raises the doctors' limit; (2) a type change
// after its preview keeps the override; (3) a setting is locked with a value; (4) support access
// is opened (clinic web in a new tab at the hand-off), shown with its time left and ended; (5) the
// owner signs in and the usage tab and the clinics list show it. Every screen on the way is axe
// clean in light and dark (`look()`); with `E2E_SHOTS` set, each is also captured.
import {
  type Browser,
  type BrowserContext,
  devices,
  expect,
  type Page,
  test,
} from '@playwright/test';
import type {
  ClinicCreated,
  ClinicEntitlements,
  ClinicList,
  ClinicSettingList,
  ClinicUsage,
  OverrideHistory,
  PlatformSupportGrants,
  TypePreview,
} from '@shifa/contracts';
import { createRandom, fullName, generatePersonName, generatePhone } from '@shifa/testing';
import { look } from '../support/look.ts';
import { consumeSetupLink, expectCall, signInInPage } from '../support/page.ts';
import { seeded, urls } from '../support/run.ts';
import { enrolThroughScreens, setPasswordFromLink } from '../support/screens.ts';

const PASSWORD = 'جملة-سرية-لرحلة-التبويبات';
// Its own seed, so no phone is shared with another spec (see account-clinics.spec.ts).
const random = createRandom(2026_11_30);
const person = () =>
  fullName(generatePersonName(random, { sex: 'female', adult: true, region: 'aleppo' }));

test.describe.configure({ mode: 'serial' });
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

const clinic = { name: 'مجمع التبويبات الطبي', id: '', ownerToken: '' };
const owner = { phone: generatePhone(random, 'SY'), name: person() };
let admin: Page;

const row = (page: Page, key: string) => page.locator('[data-row]', { hasText: key });
async function openTab(page: Page, name: string) {
  await page.getByRole('tab', { name, exact: true }).click();
}

test('(1) an override raises the doctors’ limit and the tab shows the new effective value', async ({
  browser,
}) => {
  const base = urls().admin;
  admin = await personPage(browser);
  const { tabsAdmin } = seeded();
  await setPasswordFromLink(
    admin,
    `${base}/setup#${tabsAdmin.token}`,
    PASSWORD,
    'حفظ والمتابعة إلى التحقق',
  );
  await enrolThroughScreens(admin, 'متابعة إلى إدارة شفاء');
  await expect(admin).toHaveURL(`${base}/`);
  const created = await expectCall<ClinicCreated>(admin, 201, 'POST', '/platform/clinics', {
    name: clinic.name,
    type: 'multi_branch',
    status: 'active',
    ownerName: owner.name,
    ownerPhone: owner.phone,
  });
  clinic.id = created.clinic.id;
  clinic.ownerToken = new URL(created.ownerLink.url).hash.slice(1);

  // The contract check (A-02-08 checkpoint 1): each row's route answers with its fields.
  const at = `/platform/clinics/${clinic.id}`;
  const ent = await expectCall<ClinicEntitlements>(admin, 200, 'GET', `${at}/entitlements`);
  expect(ent.plan).toBe('multi_branch');
  expect(ent.items.map((i) => i.key).sort()).toEqual([
    'limits.branches',
    'limits.custom_fields',
    'limits.practitioners',
  ]);
  for (const item of ent.items) {
    expect(Object.keys(item).sort()).toEqual(
      ['effective', 'key', 'kind', 'override', 'planValue', 'used'].sort(),
    );
  }
  const preview = await expectCall<TypePreview>(admin, 200, 'GET', `${at}/type-preview?type=solo`);
  expect(Object.keys(preview.limits[0] ?? {}).sort()).toEqual(
    ['current', 'key', 'next', 'over', 'used'].sort(),
  );
  const same = await admin.evaluate(
    async (path) => (await fetch(`/api${path}`)).status,
    `${at}/type-preview?type=multi_branch`,
  );
  expect(same).toBe(400);
  const history = await expectCall<OverrideHistory>(
    admin,
    200,
    'GET',
    `${at}/overrides/limits.practitioners/history`,
  );
  expect(history.events).toEqual([]);
  const settings = await expectCall<ClinicSettingList>(admin, 200, 'GET', `${at}/settings`);
  expect(Object.keys(settings.settings[0] ?? {}).sort()).toEqual(
    ['choices', 'key', 'lockable', 'locked', 'lockedBy', 'source', 'value'].sort(),
  );
  const grants = await expectCall<PlatformSupportGrants>(admin, 200, 'GET', `${at}/support-grants`);
  expect(grants).toMatchObject({ mine: null, grants: [] });
  expect(typeof grants.now).toBe('string');
  const usage = await expectCall<ClinicUsage>(admin, 200, 'GET', `${at}/usage`);
  expect(usage.days).toHaveLength(30);
  expect(typeof usage.hasData).toBe('boolean');
  const list = await expectCall<ClinicList>(admin, 200, 'GET', '/platform/clinics');
  const mine = list.clinics.find((c) => c.id === clinic.id);
  expect(mine).toMatchObject({ lastActivityAt: null, signIns7d: 0 });

  await admin.goto(`${base}/clinics/${clinic.id}`);
  await expect(admin.getByRole('heading', { name: clinic.name, level: 1 })).toBeVisible();
  await openTab(admin, 'الاشتراك والحدود');
  const doctors = row(admin, 'limits.practitioners');
  await expect(doctors).toContainText('30');
  await look(admin, 'a02-limits');
  await doctors.getByRole('button', { name: 'تجاوز' }).click();
  const dialog = admin.getByRole('dialog', { name: 'تجاوز حد الأطباء' });
  await dialog.getByLabel('القيمة', { exact: true }).fill('35');
  await dialog.getByRole('button', { name: 'حفظ التجاوز' }).click();
  await expect(dialog.getByText('اكتب سبب التجاوز')).toBeVisible();
  await look(admin, 'a02-override-missing-reason');
  await dialog.getByRole('textbox', { name: 'السبب' }).fill('توسعة قسم الأطفال المسائي');
  await dialog.getByRole('button', { name: 'حفظ التجاوز' }).click();
  await expect(dialog).toBeHidden();
  await expect(admin.getByText('حُفظ التجاوز')).toBeVisible();
  await expect(doctors.locator('[data-effective]')).toHaveText('35');
  await look(admin, 'a02-override-saved');
  await doctors.getByRole('button', { name: 'السجل' }).click();
  const drawer = admin.getByRole('dialog', { name: 'سجل حد الأطباء' });
  await expect(drawer).toContainText('وُضع');
  await expect(drawer).toContainText('السبب: توسعة قسم الأطفال المسائي');
  await look(admin, 'a02-override-history');
  await drawer.getByRole('button', { name: 'إغلاق' }).click();
});

test('(2) a type change after its preview keeps the override', async () => {
  await admin.getByRole('button', { name: 'تغيير النوع' }).click();
  const dialog = admin.getByRole('dialog', { name: 'تغيير نوع العيادة' });
  await expect(dialog).toContainText('35 (يبقى التجاوز)');
  await expect(dialog).toContainText('الفروع');
  await look(admin, 'a02-type-preview');
  await dialog.getByRole('button', { name: 'تغيير النوع' }).click();
  await expect(dialog).toBeHidden();
  await expect(admin.getByText('تغيّر نوع العيادة إلى «عيادة فردية»')).toBeVisible();
  await expect(row(admin, 'limits.practitioners').locator('[data-effective]')).toHaveText('35');
  await expect(row(admin, 'limits.branches').locator('[data-effective]')).toHaveText('1');
  await look(admin, 'a02-type-saved');
});

test('(3) a setting is locked with a value', async () => {
  await openTab(admin, 'الإعدادات');
  const idle = row(admin, 'session.idle_minutes');
  await expect(idle).toContainText('موروث من: الإعداد الافتراضي');
  await look(admin, 'a02-settings');
  await idle.getByRole('button', { name: 'قفل بقيمة' }).click();
  const dialog = admin.getByRole('dialog', { name: 'قفل «الخروج عند عدم النشاط»' });
  await look(admin, 'a02-settings-lock');
  await dialog.getByRole('button', { name: 'قفل', exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(idle).toContainText('مقفل من الإدارة');
  await expect(idle).toContainText('من: الإدارة');
  await look(admin, 'a02-settings-locked');
  const read = await expectCall<ClinicSettingList>(
    admin,
    200,
    'GET',
    `/platform/clinics/${clinic.id}/settings`,
  );
  expect(read.settings[0]).toMatchObject({ locked: true, lockedBy: 'organization' });
});

test('(4) support access is opened in a new tab, shown with its time left, then ended', async () => {
  await openTab(admin, 'دخول الدعم');
  await expect(admin.getByText('فتح دخول الدعم')).toBeVisible();
  await look(admin, 'a02-support-form');
  await admin.getByRole('textbox', { name: 'السبب' }).fill('فرع العزيزية غائب عن قائمة الفروع');
  const opened = admin.context().waitForEvent('page');
  await admin.getByRole('button', { name: 'فتح الدخول' }).click();
  const tab = await opened;
  // The tab opens empty in the click and is sent to the hand-off once it arrives.
  // Booleans only: waitForURL or a failed match would print the hand-off.
  await expect
    .poll(() => tab.url().startsWith(`${urls().clinic}/`), { message: 'clinic web opened' })
    .toBe(true);
  expect(await tab.evaluate(() => window.opener === null), 'no opener').toBe(true);
  await tab.close();
  await expect(admin.getByText('دخولك مفتوح')).toBeVisible();
  await expect(admin.getByText(/متبقٍّ (60|59) دقيقة/)).toBeVisible();
  await look(admin, 'a02-support-open');
  await admin.getByRole('button', { name: 'إنهاء', exact: true }).click();
  await admin.getByRole('alertdialog').getByRole('button', { name: 'إنهاء الدخول' }).click();
  await expect(admin.getByText('انتهى دخولك')).toBeVisible();
  await expect(admin.getByRole('grid', { name: 'سجل دخول الدعم' })).toContainText(
    'فرع العزيزية غائب عن قائمة الفروع',
  );
  await look(admin, 'a02-support-ended');
});

test('(5) usage appears after the owner’s sign-ins, on the tab and in the list', async ({
  browser,
}) => {
  const clinicWeb = urls().clinic;
  const ownerPage = await personPage(browser);
  await ownerPage.goto(`${clinicWeb}/sign-in`);
  await consumeSetupLink(ownerPage, clinic.ownerToken, PASSWORD);
  const again = await personPage(browser);
  await again.goto(`${clinicWeb}/sign-in`);
  await signInInPage(again, owner.phone, PASSWORD);
  const usage = await expectCall<ClinicUsage>(
    admin,
    200,
    'GET',
    `/platform/clinics/${clinic.id}/usage`,
  );
  expect(usage.hasData).toBe(true);
  expect(usage.todayCounts.signIns).toBeGreaterThan(0);

  await admin.reload();
  await openTab(admin, 'الاستخدام');
  await expect(admin.locator('[data-stat="signIns"]')).toContainText(
    String(usage.todayCounts.signIns),
  );
  await expect(admin.getByRole('group', { name: /آخر 30 يومًا/ })).toBeVisible();
  await look(admin, 'a02-usage');
  await admin.getByRole('radio', { name: 'الأعضاء الذين سجّلوا الدخول' }).click();
  await look(admin, 'a02-usage-members');

  await admin.goto(`${urls().admin}/`);
  const listed = admin.getByRole('row').filter({ hasText: clinic.name });
  await expect(listed).toContainText(/اليوم \d\d:\d\d/);
  // Only today has sign-ins, so the seven days hold today's count.
  await expect(listed).toContainText(String(usage.todayCounts.signIns));
  await look(admin, 'a02-clinics');
  await admin.getByRole('switch', { name: /بلا نشاط منذ 7 أيام/ }).click();
  await expect(admin.getByRole('row').filter({ hasText: clinic.name })).toHaveCount(0);
  await look(admin, 'a02-clinics-inactive');
});
