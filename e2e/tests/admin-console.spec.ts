// Slice A-02-09 checkpoint 4: admin web's flags, announcements, cities and areas through the real
// screens, against the built API, a real database and the built app (A-02 criteria 7, 15, 16,
// 22–24 as the super admin sees them). In order: (1) the fifth seeded super admin enrols and
// opens «الميزات التجريبية»: Release 1 declares no flag in code, so the real list is the "none
// declared" state (the kill switch's confirmation is covered by the page tests); (2) an
// announcement for two selected clinics is created, edited and ended early; (3) a new city gets
// two areas, one is archived and shown under «عرض المؤرشفة». Every screen is axe clean in light
// and dark (`look()`); with `E2E_SHOTS` set, each is captured for the comparison with the drawings.
import { type BrowserContext, devices, expect, type Page, test } from '@playwright/test';
import { look } from '../support/look.ts';
import { seeded, urls } from '../support/run.ts';
import { enrolThroughScreens, setPasswordFromLink } from '../support/screens.ts';

const PASSWORD = 'جملة-سرية-لرحلة-لوحة-الإدارة';
const FIRST = 'عيادة الرحلات الأولى';
const SECOND = 'عيادة الرحلات الثانية';
const BODY = 'صيانة قصيرة الليلة، احفظوا عملكم قبلها';
const EDITED = 'صيانة قصيرة الليلة من 11 إلى 12، احفظوا عملكم قبلها';
const CITY = 'مارع';

test.describe.configure({ mode: 'serial' });
test.setTimeout(150_000);

let context: BrowserContext;
let admin: Page;
test.afterAll(async () => {
  await context.close();
});

test('(1) the super admin enrols and sees the flags declared in code', async ({ browser }) => {
  const base = urls().admin;
  context = await browser.newContext({
    ...devices['Desktop Chrome'],
    viewport: { width: 1440, height: 1000 },
    locale: 'ar-SY',
    serviceWorkers: 'block',
  });
  admin = await context.newPage();
  const { consoleAdmin } = seeded();
  await setPasswordFromLink(
    admin,
    `${base}/setup#${consoleAdmin.token}`,
    PASSWORD,
    'حفظ والمتابعة إلى التحقق',
  );
  await enrolThroughScreens(admin, 'متابعة إلى إدارة شفاء');
  await expect(admin.getByRole('heading', { name: 'العيادات', level: 1 })).toBeVisible();

  const nav = admin.getByRole('navigation', { name: 'القائمة الرئيسية' });
  await nav.getByRole('link', { name: 'الميزات التجريبية' }).click();
  await expect(admin).toHaveURL(`${base}/flags`);
  await expect(admin.getByRole('heading', { name: 'الميزات التجريبية', level: 1 })).toBeVisible();
  await expect(nav.getByRole('link', { name: 'الميزات التجريبية' })).toHaveAttribute(
    'aria-current',
    'page',
  );
  await expect(admin.getByRole('heading', { name: 'لا ميزات تجريبية معرّفة' })).toBeVisible();
  await look(admin, 'a02-flags-none');
});

test('(2) an announcement for selected clinics is created, edited and ended early', async () => {
  const base = urls().admin;
  const nav = admin.getByRole('navigation', { name: 'القائمة الرئيسية' });
  await nav.getByRole('link', { name: 'الإعلانات' }).click();
  await expect(admin).toHaveURL(`${base}/announcements`);
  await expect(admin.getByRole('heading', { name: 'لا إعلانات بعد' })).toBeVisible();
  await look(admin, 'a02-announcements-empty');

  await admin.getByRole('button', { name: 'إعلان جديد' }).first().click();
  const form = admin.getByRole('dialog', { name: 'إعلان جديد' });
  await expect(form).toBeVisible();
  // A link is refused before sending.
  await form.getByLabel('النص').fill('حدّثوا التطبيق من www.example.com');
  await form.getByRole('button', { name: 'نشر الإعلان' }).click();
  await expect(form.getByText('لا يُقبل رابط في نص الإعلان')).toBeVisible();
  await form.getByLabel('النص').fill(BODY);
  await form.getByRole('radio', { name: 'تنبيه' }).check();
  await expect(form.getByTestId('announcement-preview')).toContainText(BODY);
  await form.getByRole('radio', { name: 'عيادات مختارة' }).check();
  // Selected clinics without a clinic is refused.
  await form.getByRole('button', { name: 'نشر الإعلان' }).click();
  await expect(form.getByText('اختر عيادة واحدة على الأقل')).toBeVisible();
  const picker = form.getByRole('combobox', { name: 'العيادات المختارة' });
  for (const name of [FIRST, SECOND]) {
    await picker.fill(name);
    await admin.getByRole('option', { name }).click();
  }
  await picker.press('Escape');
  await look(admin, 'a02-announcement-form');
  await form.getByRole('button', { name: 'نشر الإعلان' }).click();

  await expect(admin.getByText('نُشر الإعلان')).toBeVisible();
  const row = admin.locator('[data-row]', { hasText: BODY });
  await expect(row).toContainText('نشط');
  await expect(row).toContainText(FIRST);
  await expect(row).toContainText(SECOND);
  await expect(row).toContainText('أغلقه 0 من');
  await look(admin, 'a02-announcements-active');

  await row.getByRole('button', { name: `تعديل الإعلان: ${BODY}` }).click();
  const edit = admin.getByRole('dialog', { name: 'تعديل الإعلان' });
  await edit.getByLabel('النص').fill(EDITED);
  await edit.getByRole('button', { name: 'حفظ التعديل' }).click();
  await expect(admin.getByText('حُفظ التعديل')).toBeVisible();
  const edited = admin.locator('[data-row]', { hasText: EDITED });
  await expect(edited).toBeVisible();

  // Each row's buttons are named with its body («إنهاء الإعلان: …»).
  await edited.getByRole('button', { name: `إنهاء الإعلان: ${EDITED}` }).click();
  const ask = admin.getByRole('alertdialog', { name: 'إنهاء الإعلان الآن؟' });
  await expect(ask).toBeVisible();
  await ask.getByRole('button', { name: 'إنهاء الآن' }).click();
  await expect(admin.getByText('انتهى الإعلان', { exact: true })).toBeVisible();
  await admin.getByRole('radiogroup', { name: 'حالة الإعلان' }).getByText('المنتهية').click();
  const ended = admin.locator('[data-row]', { hasText: EDITED });
  await expect(ended).toContainText('أُنهي مبكرًا');
  await expect(ended.getByRole('button')).toHaveCount(0);
  await look(admin, 'a02-announcements-ended');
});

test('(3) a city gets two areas; one is archived and shown under «عرض المؤرشفة»', async () => {
  const base = urls().admin;
  const nav = admin.getByRole('navigation', { name: 'القائمة الرئيسية' });
  await nav.getByRole('link', { name: 'المدن والمناطق' }).click();
  await expect(admin).toHaveURL(`${base}/places`);
  // The seeded list: Aleppo and its areas, Azaz.
  await expect(admin.locator('[data-row]', { hasText: 'حلب' }).first()).toBeVisible();
  await look(admin, 'a02-places-list');

  await admin.getByLabel('مدينة جديدة', { exact: true }).fill(CITY);
  await admin.getByLabel('مدينة جديدة', { exact: true }).press('Enter');
  await expect(admin.getByText(`أُضيفت «${CITY}»`)).toBeVisible();
  await admin.getByRole('button', { name: CITY, exact: true }).click();
  await expect(admin.getByRole('heading', { name: `مناطق ${CITY}` })).toBeVisible();
  await expect(admin.getByText('لا مناطق بعد', { exact: true }).last()).toBeVisible();
  for (const area of ['الحي الشمالي', 'الحي الجنوبي']) {
    await admin.getByLabel('منطقة جديدة', { exact: true }).fill(area);
    await admin.getByLabel('منطقة جديدة', { exact: true }).press('Enter');
    await expect(admin.getByText(`أُضيفت «${area}»`)).toBeVisible();
  }
  // A name that exists is refused on the field.
  await admin.getByLabel('منطقة جديدة', { exact: true }).fill('الحي الشمالي');
  await admin.getByLabel('منطقة جديدة', { exact: true }).press('Enter');
  await expect(admin.getByText(`«الحي الشمالي» موجودة في ${CITY}.`)).toBeVisible();
  await admin.getByLabel('منطقة جديدة', { exact: true }).fill('');
  // The search: the start of a word finds the area (the Arabic fold is in the page tests).
  await admin.getByLabel('ابحث عن مدينة أو منطقة').fill('الحي الجن');
  await expect(admin.locator('[data-row]', { hasText: 'الحي الجنوبي' })).toBeVisible();
  await expect(admin.locator('[data-row]', { hasText: 'الحي الشمالي' })).toHaveCount(0);
  await admin.getByLabel('ابحث عن مدينة أو منطقة').fill('');

  await admin.getByRole('button', { name: 'إجراءات الحي الجنوبي' }).click();
  await admin.getByRole('menuitem', { name: 'أرشفة' }).click();
  const ask = admin.getByRole('alertdialog', { name: '«الحي الجنوبي»' });
  await expect(ask).toContainText('لا فرع يحمله الآن');
  await ask.getByRole('button', { name: 'أرشفة' }).click();
  await expect(admin.getByText('أُرشفت «الحي الجنوبي»')).toBeVisible();
  await expect(admin.locator('[data-row]', { hasText: 'الحي الجنوبي' })).toHaveCount(0);

  await admin.getByRole('switch', { name: 'عرض المؤرشفة' }).click();
  const archived = admin.locator('[data-row]', { hasText: 'الحي الجنوبي' });
  await expect(archived).toContainText('مؤرشفة');
  await expect(archived.getByRole('button', { name: 'استعادة الحي الجنوبي' })).toBeVisible();
  await look(admin, 'a02-places-archived');
});
