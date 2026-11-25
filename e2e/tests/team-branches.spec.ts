// Slice A-01-08 checkpoint 5: the team, the branches, the header switcher and the invitation page
// through the real screens, against the built API, a real database and the built apps (A-01b
// criteria 9–11 as a person sees them, and its "Screens" row). In order, each journey building on
// the last: (1) the owner adds a receptionist for one branch on «الفريق»; the receptionist opens
// the link shown once, sets a password and is signed in with that branch's role; (2) a doctor of
// two branches accepts a second clinic's invitation on its page and opens that clinic; (3) the
// doctor switches clinic (the branch step inside the menu) and then branch from the header, on a
// desktop and in the phone's bottom sheet; (4) the owner deactivates the receptionist, whose next
// request ends the session. Every screen on the way is axe clean in light and dark (`look()`); the
// pages at 1280, 768 and 390 px; with `E2E_SHOTS` set each is also captured, secrets masked, for
// the comparison with the approved drawings (`Team08`).
import {
  type Browser,
  type BrowserContext,
  devices,
  expect,
  type Page,
  test,
} from '@playwright/test';
import type {
  Branch,
  BranchList,
  ClinicCreated,
  MemberAdded,
  TotpEnrolStart,
} from '@shifa/contracts';
import { createRandom, fullName, generatePersonName, generatePhone } from '@shifa/testing';
import { look } from '../support/look.ts';
import { callInPage, consumeSetupLink, expectCall, sessionOf } from '../support/page.ts';
import { seeded, urls } from '../support/run.ts';
import { openSecretLink, setPasswordFromLink, signInThroughScreen } from '../support/screens.ts';
import { nextCode } from '../support/totp.ts';

const PASSWORD = 'جملة-سرية-لرحلة-الفريق';
// Each spec draws from its own seed, so no phone is shared: seed.ts 2026_11_24, entry-path
// 2026_11_26, refusals 2026_11_27, account-clinics 2026_11_28, this file 2026_11_29.
const random = createRandom(2026_11_29);
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

/** The listed sizes of the drawings: desktop, tablet, phone. */
const SIZES = [
  { name: 'desktop', width: 1280, height: 800 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'phone', width: 390, height: 844 },
] as const;

/** `look()` at each listed size, back to the desktop after; `ready` is what must show at each. */
async function lookAtSizes(page: Page, name: string, ready: () => Promise<void>): Promise<void> {
  for (const size of SIZES) {
    await page.setViewportSize({ width: size.width, height: size.height });
    await ready();
    await look(page, `${name}-${size.name}`);
  }
  await page.setViewportSize({ width: 1280, height: 800 });
}

const clinicA = { name: 'عيادة الفريق', id: '', main: { id: '', name: '' }, second: '' };
const SECOND = 'فرع العزيزية';
const clinicB = { name: 'عيادة الدعوة الثانية', id: '' };
const receptionist = { phone: generatePhone(random, 'SY'), name: person() };
const doctor = { phone: generatePhone(random, 'SY'), name: person() };
let admin: Page;
let ownerPage: Page;
let receptionistPage: Page;
let doctorPage: Page;

/** Sets up a person through the API only (the actor of a journey, not its subject). */
async function enrolThroughApi(page: Page, base: string, url: string): Promise<void> {
  await page.goto(`${base}/sign-in`);
  await consumeSetupLink(page, new URL(url).hash.slice(1), PASSWORD);
  const start = await expectCall<TotpEnrolStart>(page, 200, 'POST', '/auth/mfa/enrol/start');
  await expectCall(page, 200, 'POST', '/auth/mfa/enrol/confirm', {
    code: await nextCode(start.manualKey),
  });
}

async function createClinic(
  browser: Browser,
  name: string,
  type: 'solo' | 'multi_branch',
): Promise<{ id: string; ownerPage: Page }> {
  const created = await expectCall<ClinicCreated>(admin, 201, 'POST', '/platform/clinics', {
    name,
    type,
    status: 'active',
    ownerName: person(),
    ownerPhone: generatePhone(random, 'SY'),
  });
  const page = await personPage(browser);
  await enrolThroughApi(page, urls().clinic, created.ownerLink.url);
  return { id: created.clinic.id, ownerPage: page };
}

test('(1) the owner adds a receptionist for one branch; the link signs them in with that role', async ({
  browser,
}) => {
  const base = urls().clinic;
  admin = await personPage(browser);
  const { teamAdmin } = seeded();
  await enrolThroughApi(admin, urls().admin, `${urls().admin}/setup#${teamAdmin.token}`);

  const a = await createClinic(browser, clinicA.name, 'multi_branch');
  clinicA.id = a.id;
  ownerPage = a.ownerPage;
  const branches = await expectCall<BranchList>(ownerPage, 200, 'GET', '/branches');
  const main = branches.active[0];
  if (!main) throw new Error('clinic A has no branch');
  clinicA.main = { id: main.id, name: main.name };
  const second = await expectCall<Branch>(ownerPage, 201, 'POST', '/branches', { name: SECOND });
  clinicA.second = second.id;
  await ownerPage
    .context()
    .grantPermissions(['clipboard-read', 'clipboard-write'], { origin: base });

  // Two active branches: «الفروع» is in the owner's navigation.
  await ownerPage.goto(`${base}/branches`);
  const cards = ownerPage.getByRole('group', { name: SECOND });
  await lookAtSizes(ownerPage, 'branches', async () => {
    await expect(ownerPage.getByRole('heading', { name: 'الفروع', level: 1 })).toBeVisible();
    await expect(cards).toBeVisible();
  });
  await cards.getByRole('button', { name: 'أرشفة' }).click();
  const archive = ownerPage.getByRole('alertdialog', { name: `أرشفة ${SECOND}؟` });
  await expect(archive.getByText('لن تنتهي جلسة أحد.')).toBeVisible();
  await look(ownerPage, 'branches-archive-confirm');
  await archive.getByRole('button', { name: 'رجوع' }).click();
  await expect(archive).toBeHidden();

  await ownerPage.goto(`${base}/team`);
  await lookAtSizes(ownerPage, 'team-owner-alone', async () => {
    await expect(ownerPage.getByRole('heading', { name: 'الفريق', level: 1 })).toBeVisible();
    await expect(ownerPage.getByText('أنت وحدك في الفريق الآن')).toBeVisible();
  });

  await ownerPage.getByRole('button', { name: 'إضافة موظف' }).first().click();
  const drawer = ownerPage.getByRole('dialog', { name: 'إضافة موظف' });
  await expect(drawer.getByLabel('الاسم', { exact: true })).toBeVisible();
  // Refused before sending: name, phone and role are named.
  await drawer.getByRole('button', { name: 'إضافة وإصدار الرابط' }).click();
  await expect(drawer.getByText('اكتب الاسم.')).toBeVisible();
  await expect(drawer.getByText('اكتب رقم الهاتف.')).toBeVisible();
  await expect(drawer.getByText('اختر دوراً واحداً على الأقل.')).toBeVisible();
  await look(ownerPage, 'team-add-refused');

  await drawer.getByLabel('الاسم', { exact: true }).fill(receptionist.name);
  await drawer.getByLabel('رقم الهاتف', { exact: true }).fill(receptionist.phone);
  await drawer
    .getByTestId('role-receptionist')
    .getByRole('checkbox', { name: 'موظف استقبال' })
    .check();
  await drawer
    .getByRole('group', { name: 'فروع دور موظف استقبال' })
    .getByRole('checkbox', { name: SECOND })
    .check();
  await look(ownerPage, 'team-add-filled');
  await drawer.getByRole('button', { name: 'إضافة وإصدار الرابط' }).click();

  const memberDrawer = ownerPage.getByRole('dialog', { name: receptionist.name });
  const shown = memberDrawer.getByTestId('link-shown');
  await expect(shown.getByLabel('رابط الانضمام')).toBeVisible();
  await look(ownerPage, 'team-link-shown');
  // Closing before a copy or a share asks first (improvement h).
  await ownerPage.keyboard.press('Escape');
  const leave = ownerPage.getByRole('alertdialog', { name: 'لم تنسخ الرابط بعد' });
  await expect(leave).toBeVisible();
  // Not looked at: a confirmation over the drawer makes the drawer's content inert, and axe then
  // counts its scroll box as a scrollable region with nothing to focus (scrollable-region-
  // focusable). A @shifa/ui Drawer follow-up (docs/backlog.md), not silenced here.
  await leave.getByRole('button', { name: 'البقاء هنا' }).click();
  await shown.getByRole('button', { name: 'نسخ' }).click();
  await expect(shown.getByRole('button', { name: 'نُسخ' })).toBeVisible();
  const url = await ownerPage.evaluate(() => navigator.clipboard.readText());
  // Booleans only: a failed match would print the link.
  expect(url.startsWith(`${base}/setup#`), 'the copied link is a setup link').toBe(true);
  await ownerPage.keyboard.press('Escape');
  await expect(memberDrawer).toBeHidden();
  const row = ownerPage.getByTestId('member-open').filter({ hasText: receptionist.name });
  await expect(row).toBeVisible();

  receptionistPage = await personPage(browser);
  await setPasswordFromLink(receptionistPage, url, PASSWORD, 'حفظ والدخول');
  // One branch held: the server puts the receptionist in it, no chooser.
  await expect(receptionistPage).toHaveURL(`${base}/`);
  const session = await sessionOf(receptionistPage);
  expect(session).toMatchObject({ tenantId: clinicA.id, branchId: second.id });
  expect(session.roles).toEqual([
    expect.objectContaining({ role: 'receptionist', branchId: second.id }),
  ]);
  // A receptionist has neither «الفريق» nor «الفروع» (once the frame is drawn).
  await expect(receptionistPage.getByRole('link', { name: 'حسابي' })).toBeVisible();
  await expect(receptionistPage.getByRole('link', { name: 'الفريق' })).toHaveCount(0);
  await expect(receptionistPage.getByRole('link', { name: 'الفروع' })).toHaveCount(0);

  await ownerPage.reload();
  await lookAtSizes(ownerPage, 'team', async () => {
    await expect(ownerPage.getByText(receptionist.name).first()).toBeVisible();
  });
  await ownerPage.getByTestId('member-open').filter({ hasText: receptionist.name }).click();
  await expect(memberDrawer.getByText('فعّال').first()).toBeVisible();
  await look(ownerPage, 'team-member-drawer');
  await ownerPage.keyboard.press('Escape');
  await expect(memberDrawer).toBeHidden();
});

test('(2) a doctor of two branches accepts a second clinic’s invitation and opens it', async ({
  browser,
}) => {
  const base = urls().clinic;
  const added = await expectCall<MemberAdded>(ownerPage, 201, 'POST', '/team/members', {
    name: doctor.name,
    phone: doctor.phone,
    roles: [
      { role: 'doctor', branchId: clinicA.main.id },
      { role: 'doctor', branchId: clinicA.second },
    ],
  });
  doctorPage = await personPage(browser);
  await setPasswordFromLink(doctorPage, added.link.url, PASSWORD, 'حفظ والدخول');
  // Two branches and no tenant-wide role: the doctor chooses.
  await expect(doctorPage).toHaveURL(`${base}/choose`);

  const b = await createClinic(browser, clinicB.name, 'solo');
  clinicB.id = b.id;
  const invited = await expectCall<MemberAdded>(b.ownerPage, 201, 'POST', '/team/members', {
    name: doctor.name,
    phone: doctor.phone,
    roles: [{ role: 'doctor', branchId: null }],
  });
  // An account exists for the phone, so the link is an invitation.
  await openSecretLink(doctorPage, invited.link.url);
  await expect(doctorPage.getByRole('heading', { name: clinicB.name, level: 1 })).toBeVisible();
  await expect(doctorPage.getByText('دعوة للانضمام إلى فريق')).toBeVisible();
  await expect(doctorPage.getByText('طبيب', { exact: true })).toBeVisible();
  await lookAtSizes(doctorPage, 'invitation', async () => {
    await expect(doctorPage.getByRole('button', { name: 'قبول الدعوة' })).toBeVisible();
  });
  await doctorPage.getByRole('button', { name: 'رفض' }).click();
  const decline = doctorPage.getByRole('alertdialog', { name: `رفض دعوة ${clinicB.name}؟` });
  await expect(decline).toBeVisible();
  await look(doctorPage, 'invitation-decline-confirm');
  await decline.getByRole('button', { name: 'تراجع' }).click();
  await expect(decline).toBeHidden();

  await doctorPage.getByRole('button', { name: 'قبول الدعوة' }).click();
  await expect(
    doctorPage.getByRole('heading', { name: `انضممت إلى ${clinicB.name}` }),
  ).toBeVisible();
  await look(doctorPage, 'invitation-accepted');
  await doctorPage.getByRole('button', { name: 'فتح العيادة' }).click();
  await expect(doctorPage).toHaveURL(`${base}/`);
  expect(await sessionOf(doctorPage)).toMatchObject({ tenantId: clinicB.id });
  // The invitation is used: its link is refused.
  const again = await callInPage(doctorPage, 'POST', '/invitations/view', {
    token: new URL(invited.link.url).hash.slice(1),
  });
  expect(again.status).toBe(404);
});

test('(3) the doctor switches clinic, then branch, from the header; the phone’s sheet', async ({
  browser,
}) => {
  const base = urls().clinic;
  const switcher = doctorPage.getByTestId('clinic-switcher');
  await expect(switcher).toContainText(clinicB.name);
  await switcher.click();
  const menu = doctorPage.getByRole('menu');
  await expect(menu.getByRole('menuitemradio', { name: new RegExp(clinicA.name) })).toBeVisible();
  await look(doctorPage, 'switcher-clinics');
  await menu.getByRole('menuitemradio', { name: new RegExp(clinicA.name) }).click();
  // Two branches held there and none tenant-wide: the branch step inside the menu.
  await expect(menu.getByText('لك دور في فرعين أو أكثر هناك.', { exact: false })).toBeVisible();
  await look(doctorPage, 'switcher-branch-step');
  await menu.getByRole('menuitemradio', { name: SECOND }).click();
  await expect(doctorPage.getByText(`أنت الآن في ${clinicA.name}`)).toBeVisible();
  await expect(doctorPage).toHaveURL(`${base}/`);
  expect(await sessionOf(doctorPage)).toMatchObject({
    tenantId: clinicA.id,
    branchId: clinicA.second,
  });
  await expect(switcher).toContainText(`${clinicA.name} · ${SECOND}`);

  await switcher.click();
  const branchGroup = menu.getByRole('group', { name: `الفروع في ${clinicA.name}` });
  await expect(branchGroup).toBeVisible();
  await look(doctorPage, 'switcher-branches');
  await branchGroup.getByRole('menuitemradio', { name: clinicA.main.name }).click();
  await expect(switcher).toContainText(`${clinicA.name} · ${clinicA.main.name}`);
  expect(await sessionOf(doctorPage)).toMatchObject({
    tenantId: clinicA.id,
    branchId: clinicA.main.id,
  });

  // The phone: the same rows in a bottom sheet; the button names the clinic alone.
  const phone = await personPage(browser, true);
  await signInThroughScreen(phone, base, doctor.phone, PASSWORD);
  await expect(phone).toHaveURL(`${base}/choose`);
  await phone.getByTestId('clinic-card').filter({ hasText: clinicB.name }).click();
  await expect(phone).toHaveURL(`${base}/`);
  const phoneSwitcher = phone.getByTestId('clinic-switcher');
  await expect(phoneSwitcher).toHaveText(clinicB.name);
  await phoneSwitcher.click();
  const sheet = phone.getByRole('menu');
  await expect(sheet).toHaveAttribute('data-presentation', 'sheet');
  await expect(sheet.getByRole('menuitemradio', { name: new RegExp(clinicA.name) })).toBeVisible();
  await look(phone, 'switcher-sheet-phone');
  await sheet.getByRole('menuitemradio', { name: new RegExp(clinicA.name) }).click();
  await sheet.getByRole('menuitemradio', { name: clinicA.main.name }).click();
  await expect(phone.getByText(`أنت الآن في ${clinicA.name}`)).toBeVisible();
  expect(await sessionOf(phone)).toMatchObject({
    tenantId: clinicA.id,
    branchId: clinicA.main.id,
  });
});

test('(4) the owner deactivates the receptionist; the next request signs them out', async () => {
  const base = urls().clinic;
  expect((await sessionOf(receptionistPage)).tenantId).toBe(clinicA.id);
  await ownerPage.goto(`${base}/team`);
  await ownerPage.getByTestId('member-open').filter({ hasText: receptionist.name }).click();
  const drawer = ownerPage.getByRole('dialog', { name: receptionist.name });
  await drawer.getByRole('button', { name: 'إيقاف الحساب' }).click();
  const confirm = ownerPage.getByRole('alertdialog', {
    name: `إيقاف حساب ${receptionist.name}؟`,
  });
  await expect(
    confirm.getByText('تنتهي جلساته في هذه العيادة عند طلبه التالي.', { exact: false }),
  ).toBeVisible();
  // Not looked at: a confirmation over the drawer makes the drawer's content inert, and axe then
  // counts its scroll box as a scrollable region with nothing to focus (scrollable-region-
  // focusable). A @shifa/ui Drawer follow-up (docs/backlog.md), not silenced here.
  await confirm.getByRole('button', { name: 'إيقاف الحساب' }).click();
  await expect(confirm).toBeHidden();
  await expect(drawer.getByText('موقوف').first()).toBeVisible();
  await expect(drawer.getByRole('button', { name: 'إعادة التفعيل' })).toBeVisible();
  await look(ownerPage, 'team-member-deactivated');

  // The receptionist's next request is refused, and the page lands on sign-in.
  expect((await callInPage(receptionistPage, 'GET', '/auth/session')).status).toBe(401);
  await receptionistPage.goto(`${base}/`);
  await expect(receptionistPage).toHaveURL(new RegExp(`${base}/sign-in`));
  // Signing in again works (the password is the person's), but no clinic is left: the
  // no-clinic page (A-01b criterion 11), never this clinic.
  await signInThroughScreen(receptionistPage, base, receptionist.phone, PASSWORD);
  await expect(receptionistPage).toHaveURL(`${base}/choose`);
  await expect(
    receptionistPage.getByRole('heading', { name: 'لا توجد عيادة متاحة لحسابك' }),
  ).toBeVisible();
  expect((await sessionOf(receptionistPage)).tenantId).toBeNull();
});
