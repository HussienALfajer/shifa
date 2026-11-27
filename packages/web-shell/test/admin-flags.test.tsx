// Slice A-02-09 checkpoint 2: admin web's flags («الميزات التجريبية», drawing `A02Flags`; contract
// rows "Flags · list", "Flags · change", "Flags · clinic picker"; A-02 criterion 7): each flag with
// its key, description and code default, its mode as a badge (danger for a kill switch, neutral
// for a default), the clinics, the reason and who changed it last; the change dialog (mode, the
// clinic picker for `selected`, the kill-switch warning, the reason of 10 characters), then a
// confirmation, then PUT and «تغيّرت …». States: loading, failed, none declared.
import { afterEach, describe, expect, it } from 'vitest';
import {
  ADMIN_NAME,
  a02Api,
  areaLabelled,
  dialog,
  KILLED,
  must,
  ON_ALL,
  radio,
  rowWith,
  typeArea,
  UNTOUCHED,
} from './a02-admin-support.ts';
import { openAdmin } from './admin-support.ts';
import { button, click, flush, type Rendered } from './render.tsx';
import { errorAnswer, json } from './support.ts';

let shown: Rendered | undefined;
afterEach(async () => {
  await shown?.unmount();
  shown = undefined;
});

async function open(fake = a02Api()) {
  shown = await openAdmin(fake, '/flags');
  await flush(60);
  return shown;
}

const text = () => document.body.textContent;

async function changeDialog(_shown: Rendered, key: string) {
  const row = rowWith(key);
  if (!row) throw new Error(`no row ${key}`);
  await click(button(row, 'تغيير'));
  await flush(20);
  const d = dialog();
  if (!d) throw new Error('no dialog');
  return d;
}

describe('Admin web: flags', () => {
  it('is in the admin navigation, with the announcements and the places', async () => {
    const r = await open();
    const nav = r.container.querySelector('nav');
    expect(nav?.textContent).toContain('الميزات التجريبية');
    expect(nav?.textContent).toContain('الإعلانات');
    expect(nav?.textContent).toContain('المدن والمناطق');
    expect(r.container.querySelector('h1')?.textContent).toBe('الميزات التجريبية');
    const current = nav?.querySelector('[aria-current="page"]');
    expect(current?.textContent).toContain('الميزات التجريبية');
  });

  it('lists each flag: key, description and default, mode, reason and the last change', async () => {
    await open();
    const killed = rowWith(KILLED.key);
    expect(killed?.textContent).toContain(KILLED.description);
    expect(killed?.textContent).toContain('الافتراضي في الشيفرة: مطفأة');
    expect(killed?.textContent).toContain('مطفأة للجميع');
    expect(killed?.textContent).toContain(KILLED.reason);
    expect(killed?.textContent).toContain(ADMIN_NAME);
    expect(killed?.textContent).toContain('كانت لعيادة واحدة');
    expect(rowWith(ON_ALL.key)?.textContent).toContain('مفعّلة للجميع');
    const untouched = rowWith(UNTOUCHED.key);
    expect(untouched?.textContent).toContain('لم تُغيَّر بعد');
    expect(untouched?.textContent).toContain('الافتراضي');
  });

  it('a kill switch reads as danger; a flag off by default as neutral', async () => {
    await open();
    const badge = (key: string) =>
      rowWith(key)?.querySelector('[data-badge]')?.getAttribute('data-badge');
    expect(badge(KILLED.key)).toBe('danger');
    expect(badge(UNTOUCHED.key)).toBe('neutral');
    expect(badge(ON_ALL.key)).toBe('success');
  });

  it('none declared in code has its own empty state', async () => {
    await open(a02Api({ flags: [] }));
    expect(text()).toContain('لا ميزات تجريبية معرّفة');
  });

  it('a failed read offers «إعادة المحاولة»', async () => {
    const fake = a02Api();
    fake.answers['/api/platform/flags'] = () => errorAnswer(500, 'internal_error');
    await open(fake);
    expect(text()).toContain('تعذّر التحميل');
    expect(text()).toContain('إعادة المحاولة');
  });

  it('switching off for all warns, asks for the reason, confirms, then saves', async () => {
    const fake = a02Api();
    fake.answers[`/api/platform/flags/${ON_ALL.key}`] = (body) =>
      json(200, {
        ...ON_ALL,
        ...(body as object),
        updatedByName: ADMIN_NAME,
        updatedAt: new Date().toISOString(),
      });
    const r = await open(fake);
    const d = await changeDialog(r, ON_ALL.key);
    expect(d.textContent).toContain(`تغيير «${ON_ALL.description}»`);
    await click(radio(d, 'مطفأة للجميع'));
    expect(dialog()?.textContent).toContain('إيقاف فوري للجميع');
    // No reason yet: refused on the field, nothing sent.
    await click(button(must(dialog()), 'متابعة'));
    expect(dialog()?.textContent).toContain('اكتب سبب التغيير');
    const reason = areaLabelled(must(dialog()), 'السبب');
    await typeArea(reason, 'خطأ في الحساب، إيقاف حتى الإصلاح');
    await click(button(must(dialog()), 'متابعة'));
    const confirm = dialog();
    expect(confirm?.getAttribute('role')).toBe('alertdialog');
    expect(confirm?.textContent).toContain('من «مفعّلة للجميع» إلى «مطفأة للجميع»');
    expect(fake.bodies[`/api/platform/flags/${ON_ALL.key}`]).toBeUndefined();
    await click(button(must(confirm), 'تأكيد'));
    await flush(40);
    expect(fake.bodies[`/api/platform/flags/${ON_ALL.key}`]).toEqual([
      { mode: 'off', reason: 'خطأ في الحساب، إيقاف حتى الإصلاح' },
    ]);
    expect(text()).toContain(`تغيّرت «${ON_ALL.description}»`);
    expect(text()).toContain('مطفأة الآن للجميع');
  });

  it('on for selected clinics refuses to go on without a clinic', async () => {
    const r = await open();
    const d = await changeDialog(r, UNTOUCHED.key);
    await click(radio(d, 'لعيادات مختارة'));
    expect(dialog()?.textContent).toContain('العيادات المختارة');
    const reason = areaLabelled(must(dialog()), 'السبب');
    await typeArea(reason, 'تجربة مع عيادتين قبل التعميم');
    await click(button(must(dialog()), 'متابعة'));
    expect(dialog()?.textContent).toContain('اختر عيادة واحدة على الأقل');
    expect(dialog()?.getAttribute('role')).toBe('dialog');
  });

  it('keeps the selection of a flag when its picker opens', async () => {
    const r = await open();
    const d = await changeDialog(r, KILLED.key);
    await click(radio(d, 'لعيادات مختارة'));
    expect(dialog()?.textContent).toContain(KILLED.clinics[0]?.name ?? '');
  });

  it('a 400 on the clinics names the picker; a 404 closes and reads the list again', async () => {
    const fake = a02Api();
    fake.answers[`/api/platform/flags/${KILLED.key}`] = () =>
      errorAnswer(400, 'validation_failed', { details: [{ path: 'body.clinicIds' }] });
    const r = await open(fake);
    let d = await changeDialog(r, KILLED.key);
    await click(radio(d, 'لعيادات مختارة'));
    await typeArea(areaLabelled(must(dialog()), 'السبب'), 'تشغيلها لعيادة واحدة');
    await click(button(must(dialog()), 'متابعة'));
    await click(button(must(dialog()), 'تأكيد'));
    await flush(40);
    expect(dialog()?.textContent).toContain('اختر عيادة واحدة على الأقل');

    fake.answers[`/api/platform/flags/${KILLED.key}`] = () => errorAnswer(404, 'not_found');
    const reads = fake.calls.filter((c) => c === 'GET /api/platform/flags').length;
    d = must(dialog());
    await click(button(d, 'متابعة'));
    await click(button(must(dialog()), 'تأكيد'));
    await flush(40);
    expect(text()).toContain('لم تعد هذه الميزة في الشيفرة');
    expect(fake.calls.filter((c) => c === 'GET /api/platform/flags').length).toBeGreaterThan(reads);
  });
});
