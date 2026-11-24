// Slice A-01-07 checkpoint 5: the entry path through the real screens, against the built API, a
// real database and the built apps (A-01a "Flows", criteria 4, 5, 6, 7, 9, 11, 12; A-01b 10).
// Run in this order, each journey building on the last: (5) the super admin's first sign-in on
// admin web, through the setup link to enrolment and the recovery codes; (1) that super admin
// creates a clinic through the API, and its owner opens the link in the page, sets the password,
// enrols with the journey's own authenticator, keeps the codes and is in the clinic; (2) sign-in,
// challenge, a recovery code, «بقي لديك 9 رموز», and the same code refused the second time; (3) a
// doctor in two clinics: chooser, clinic, branch; a suspended clinic not selectable; (4) the idle
// warning with the clinic's shortest limit: continue, sign out now, signed out by the timer.
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
import { expectPageAxeClean } from '../support/axe.ts';
import { callInPage, consumeSetupLink, expectCall, sessionOf } from '../support/page.ts';
import { seeded, urls } from '../support/run.ts';
import {
  enrolThroughScreens,
  passChallenge,
  setPasswordFromLink,
  signInThroughScreen,
  signOutFromHome,
  tabTo,
} from '../support/screens.ts';
import { nextCode } from '../support/totp.ts';

const PASSWORD = 'جملة-سرية-للرحلة-الثانية';
const random = createRandom(2026_11_26);
const person = () =>
  fullName(generatePersonName(random, { sex: 'male', adult: true, region: 'aleppo' }));

test.describe.configure({ mode: 'serial' });
// Each journey waits at most one 30-second TOTP step per fresh code.
test.setTimeout(120_000);

/** One browser context per person, kept across the journeys (the people stay signed in). */
const contexts: BrowserContext[] = [];
async function personPage(browser: Browser): Promise<Page> {
  const context = await browser.newContext({
    ...devices['Desktop Chrome'],
    locale: 'ar-SY',
    serviceWorkers: 'block',
  });
  contexts.push(context);
  return context.newPage();
}
test.afterAll(async () => {
  for (const context of contexts.splice(0)) await context.close();
});

const clinicA = { name: 'عيادة مسار الدخول', id: '', secondBranch: '' };
const clinicB = { name: 'عيادة الدعوة', id: '' };
const ownerA = {
  phone: generatePhone(random, 'SY'),
  name: person(),
  codes: [] as string[],
  key: '',
};
const doctor = { phone: generatePhone(random, 'SY'), name: person() };
let admin: Page;
let ownerPage: Page;
let doctorPage: Page;

test('(5) the super admin: setup link on admin web, password, enrolment, codes, admin home', async ({
  browser,
}) => {
  admin = await personPage(browser);
  const { journeyAdmin } = seeded();
  await setPasswordFromLink(
    admin,
    `${urls().admin}/setup#${journeyAdmin.token}`,
    PASSWORD,
    'حفظ والمتابعة إلى التحقق',
  );
  await expect(admin).toHaveURL(`${urls().admin}/mfa`);
  await expect(admin.getByText('حساب مشرف شفاء يحتاج رمزاً من هاتفك')).toBeVisible();
  await enrolThroughScreens(admin, 'متابعة إلى إدارة شفاء');
  await expect(admin).toHaveURL(`${urls().admin}/`);
  const session = await sessionOf(admin);
  expect(session.platformAdmin).toBe(true);
  expect(session.mfa).toBe('verified');
});

test('(1) a new clinic: the owner opens the link, sets the password, enrols and is in', async ({
  browser,
}) => {
  const created = await expectCall<ClinicCreated>(admin, 201, 'POST', '/platform/clinics', {
    name: clinicA.name,
    type: 'multi_branch',
    status: 'active',
    ownerName: ownerA.name,
    ownerPhone: ownerA.phone,
  });
  clinicA.id = created.clinic.id;
  expect(created.ownerLink.url.startsWith(`${urls().clinic}/setup#`)).toBe(true);

  ownerPage = await personPage(browser);
  await setPasswordFromLink(ownerPage, created.ownerLink.url, PASSWORD, 'حفظ والمتابعة إلى التحقق');
  await expect(ownerPage.getByText('حسابك حساب مالك العيادة')).toBeVisible();
  const enrolled = await enrolThroughScreens(ownerPage, 'متابعة إلى العيادة');
  ownerA.key = enrolled.key;
  ownerA.codes = enrolled.codes;
  await expect(ownerPage).toHaveURL(`${urls().clinic}/`);
  await expect(ownerPage.getByTestId('signed-in')).toBeVisible();
  const session = await sessionOf(ownerPage);
  expect(session).toMatchObject({ tenantId: clinicA.id, mfa: 'verified' });
});

test('(2) a recovery code signs in once: nine left, and the same code refused again', async () => {
  const base = urls().clinic;
  const [code] = ownerA.codes;
  if (code === undefined) throw new Error('no recovery codes kept');
  await signOutFromHome(ownerPage, base);

  await signInThroughScreen(ownerPage, base, ownerA.phone, PASSWORD);
  await expect(ownerPage).toHaveURL(`${base}/mfa`);
  await expect(ownerPage.getByText(`أهلاً ${ownerA.name}`)).toBeVisible();
  await ownerPage.getByRole('button', { name: 'استخدام رمز استرداد' }).click();
  await ownerPage.getByLabel('رمز الاسترداد', { exact: true }).fill(code);
  await ownerPage.getByRole('button', { name: 'تأكيد' }).click();
  await expect(ownerPage).toHaveURL(`${base}/`);
  await expect(ownerPage.getByTestId('codes-left')).toContainText('بقي لديك 9 رموز');
  await signOutFromHome(ownerPage, base);

  await signInThroughScreen(ownerPage, base, ownerA.phone, PASSWORD);
  await ownerPage.getByRole('button', { name: 'استخدام رمز استرداد' }).click();
  await ownerPage.getByLabel('رمز الاسترداد', { exact: true }).fill(code);
  await ownerPage.getByRole('button', { name: 'تأكيد' }).click();
  await expect(ownerPage.getByText('رمز الاسترداد غير صحيح أو استُعمل من قبل.')).toBeVisible();
  await expect(ownerPage).toHaveURL(`${base}/mfa`);
  // The app's code still works (and keeps the owner signed in for the next journeys).
  await ownerPage.getByRole('button', { name: 'استخدام رمز التطبيق' }).click();
  await passChallenge(ownerPage, ownerA.key);
  await expect(ownerPage).toHaveURL(`${base}/`);
});

/** Sets up an owner through the API only (the actor of a journey, not its subject). */
async function ownerThroughApi(page: Page, url: string): Promise<void> {
  await page.goto(`${urls().clinic}/sign-in`);
  await consumeSetupLink(page, new URL(url).hash.slice(1), PASSWORD);
  const start = await expectCall<TotpEnrolStart>(page, 200, 'POST', '/auth/mfa/enrol/start');
  await expectCall(page, 200, 'POST', '/auth/mfa/enrol/confirm', {
    code: await nextCode(start.manualKey),
  });
}

async function chooseClinicA(page: Page): Promise<void> {
  await expect(page).toHaveURL(`${urls().clinic}/choose`);
  await page.getByTestId('clinic-card').filter({ hasText: clinicA.name }).click();
  await expect(page.getByRole('heading', { name: 'اختر الفرع' })).toBeVisible();
  await page.getByTestId('branch-card').filter({ hasText: 'فرع الجميلية' }).click();
  await expect(page).toHaveURL(`${urls().clinic}/`);
}

test('(3) a doctor in two clinics: chooser, clinic, branch; a suspended clinic not selectable', async ({
  browser,
}) => {
  const branches = await expectCall<BranchList>(ownerPage, 200, 'GET', '/branches');
  const main = branches.active[0];
  if (!main) throw new Error('clinic A has no branch');
  const second = await expectCall<Branch>(ownerPage, 201, 'POST', '/branches', {
    name: 'فرع الجميلية',
  });
  clinicA.secondBranch = second.id;
  const added = await expectCall<MemberAdded>(ownerPage, 201, 'POST', '/team/members', {
    name: doctor.name,
    phone: doctor.phone,
    roles: [
      { role: 'doctor', branchId: main.id },
      { role: 'doctor', branchId: second.id },
    ],
  });
  doctorPage = await personPage(browser);
  await setPasswordFromLink(doctorPage, added.link.url, PASSWORD, 'حفظ والدخول');
  // Roles in two branches and none tenant-wide: the server puts the doctor in no clinic yet.
  await expect(doctorPage).toHaveURL(`${urls().clinic}/choose`);

  // Clinic B invites the same phone: an account exists, so the link is an invitation.
  const createdB = await expectCall<ClinicCreated>(admin, 201, 'POST', '/platform/clinics', {
    name: clinicB.name,
    type: 'solo',
    status: 'trial',
    ownerName: person(),
    ownerPhone: generatePhone(random, 'SY'),
  });
  clinicB.id = createdB.clinic.id;
  const ownerB = await personPage(browser);
  await ownerThroughApi(ownerB, createdB.ownerLink.url);
  const invited = await expectCall<MemberAdded>(ownerB, 201, 'POST', '/team/members', {
    name: doctor.name,
    phone: doctor.phone,
    roles: [{ role: 'doctor', branchId: null }],
  });
  await expectCall(doctorPage, 204, 'POST', '/invitations/accept', {
    token: new URL(invited.link.url).hash.slice(1),
  });

  await doctorPage.reload();
  await expect(
    doctorPage.getByRole('heading', { name: `أهلاً ${doctor.name}، اختر العيادة` }),
  ).toBeVisible();
  await expect(doctorPage.getByTestId('clinic-card')).toHaveCount(2);
  await chooseClinicA(doctorPage);
  const session = await sessionOf(doctorPage);
  expect(session).toMatchObject({ tenantId: clinicA.id, branchId: second.id });

  await expectCall(admin, 200, 'PATCH', `/platform/clinics/${clinicB.id}`, { status: 'suspended' });
  await signOutFromHome(doctorPage, urls().clinic);
  await signInThroughScreen(doctorPage, urls().clinic, doctor.phone, PASSWORD);
  await expect(doctorPage).toHaveURL(`${urls().clinic}/choose`);
  const suspended = doctorPage.getByTestId('clinic-card').filter({ hasText: clinicB.name });
  await expect(suspended).toHaveAttribute('aria-disabled', 'true');
  await expect(suspended).toContainText('موقوفة');
  await expect(suspended.getByRole('link')).toHaveCount(0);
  await expectPageAxeClean(doctorPage, 'chooser with a suspended clinic');

  // The keyboard path: Tab reaches clinic A's card (the suspended card takes no focus), Enter
  // opens the branch step, Tab and Enter pick the branch.
  const cardA = doctorPage.getByTestId('clinic-card').filter({ hasText: clinicA.name });
  await tabTo(doctorPage, cardA);
  await doctorPage.keyboard.press('Enter');
  await expect(doctorPage.getByRole('heading', { name: 'اختر الفرع' })).toBeVisible();
  await expectPageAxeClean(doctorPage, 'branch step');
  await tabTo(
    doctorPage,
    doctorPage.getByTestId('branch-card').filter({ hasText: 'فرع الجميلية' }),
  );
  await doctorPage.keyboard.press('Enter');
  await expect(doctorPage).toHaveURL(`${urls().clinic}/`);
});

test('(4) the idle warning with a 15-minute limit: continue, sign out now, then the timer', async () => {
  const base = urls().clinic;
  await expectCall(ownerPage, 200, 'PATCH', '/clinic/settings', { idleMinutes: 15 });
  // The page's clock moves; the server's does not, so the server's session stays valid and only
  // the page's timer decides. Installed before the page loads, so every timer is the fake one.
  await doctorPage.clock.install();
  await signOutFromHome(doctorPage, base);
  await signInThroughScreen(doctorPage, base, doctor.phone, PASSWORD);
  await chooseClinicA(doctorPage);
  const view = await sessionOf(doctorPage);
  expect(view.idleMinutes).toBe(15);

  const dialog = doctorPage.getByRole('alertdialog', { name: 'هل ما زلت تعمل؟' });
  await doctorPage.clock.fastForward('14:10');
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('لم نرَ نشاطاً منذ 14 دقيقة');
  await dialog.getByRole('button', { name: 'متابعة العمل' }).click();
  await expect(dialog).toBeHidden();

  await doctorPage.clock.fastForward('14:10');
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'خروج الآن' }).click();
  await expect(doctorPage).toHaveURL(`${base}/sign-in?reason=signed_out`);
  expect((await callInPage(doctorPage, 'GET', '/auth/session')).status).toBe(401);

  await signInThroughScreen(doctorPage, base, doctor.phone, PASSWORD);
  await chooseClinicA(doctorPage);
  await doctorPage.clock.fastForward('15:30');
  await expect(doctorPage).toHaveURL(new RegExp(`${base}/sign-in\\?reason=idle`));
  await expect(doctorPage.getByTestId('sign-in-reason')).toContainText('خرجت تلقائياً');
  expect((await callInPage(doctorPage, 'GET', '/auth/session')).status).toBe(401);
});
