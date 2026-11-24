// Slice A-01-10 checkpoint 2: «أجهزتي» on My account (prototype `Account10`). GET /auth/sessions:
// device · browser (null: «جهاز غير معروف»), when it signed in, its last activity, «هذا الجهاز»
// without an end button; DELETE /auth/sessions/:id after a confirmation naming the device (404:
// «كان هذا الجهاز قد خرج», the list refreshed; no connection); POST /auth/sessions/end-others
// after a confirmation with the count; improvement d: no «إخراج كل الأجهزة الأخرى» without another
// device.
import { afterEach, describe, expect, it } from 'vitest';
import { ANDROID, accountApi, inDialog, openAt, THIS_DEVICE, UNKNOWN } from './account-support.ts';
import { button, click, flush, type Rendered } from './render.tsx';
import { errorAnswer } from './support.ts';

let shown: Rendered | undefined;
afterEach(async () => {
  await shown?.unmount();
  shown = undefined;
});

async function open(fake: ReturnType<typeof accountApi>) {
  shown = await openAt(fake, '/account');
  await flush(30);
  return shown;
}

const rows = (r: Rendered) => [...r.container.querySelectorAll('[data-testid="session-row"]')];

describe('My devices', () => {
  it('lists every session: this device marked, an unknown one in words', async () => {
    const r = await open(accountApi());
    const list = rows(r);
    expect(list).toHaveLength(4);
    expect(list[0]?.textContent).toContain('Windows · Chrome');
    expect(list[0]?.textContent).toContain('هذا الجهاز');
    expect(list[0]?.querySelector('button')).toBeNull();
    expect(list[1]?.textContent).toContain('آخر نشاط قبل 3 ساعات');
    expect(list[3]?.textContent).toContain('جهاز غير معروف');
    expect(list[3]?.querySelector('button')?.textContent).toContain('إخراج');
  });

  it('ends one device after a confirmation naming it', async () => {
    const fake = accountApi();
    const r = await open(fake);
    await click(rows(r)[1]?.querySelector('button') as Element);
    expect(inDialog().textContent).toContain('إخراج Android · Chrome؟');
    await click(button(inDialog(), 'إخراجه'));
    await flush(30);
    expect(fake.calls).toContain(`DELETE /api/auth/sessions/${ANDROID.id}`);
    expect(r.container.textContent).toContain('خرج الجهاز');
    expect(rows(r)).toHaveLength(3);
  });

  it('404: the device had already signed out; the list is read again', async () => {
    const fake = accountApi();
    fake.answers[`/api/auth/sessions/${UNKNOWN.id}`] = () => errorAnswer(404, 'not_found');
    const r = await open(fake);
    const reads = fake.calls.filter((c) => c === 'GET /api/auth/sessions').length;
    await click(rows(r)[3]?.querySelector('button') as Element);
    expect(inDialog().textContent).toContain('إخراج جهاز غير معروف؟');
    await click(button(inDialog(), 'إخراجه'));
    await flush(30);
    expect(r.container.textContent).toContain('كان هذا الجهاز قد خرج');
    expect(fake.calls.filter((c) => c === 'GET /api/auth/sessions').length).toBeGreaterThan(reads);
  });

  it('no connection: the confirmation stays open and says nothing was signed out', async () => {
    const fake = accountApi();
    fake.answers[`/api/auth/sessions/${ANDROID.id}`] = () =>
      Promise.reject(new TypeError('offline'));
    const r = await open(fake);
    await click(rows(r)[1]?.querySelector('button') as Element);
    await click(button(inDialog(), 'إخراجه'));
    await flush(30);
    expect(inDialog().textContent).toContain('لم يخرج أي جهاز');
  });

  it('ends all the others after a confirmation with the count', async () => {
    const fake = accountApi();
    const r = await open(fake);
    await click(button(r.container, 'إخراج كل الأجهزة الأخرى'));
    expect(inDialog().textContent).toContain('إخراج 3 أجهزة أخرى؟');
    await click(button(inDialog(), 'إخراجها'));
    await flush(30);
    expect(fake.calls).toContain('POST /api/auth/sessions/end-others');
    expect(r.container.textContent).toContain('أخرجنا 3 أجهزة');
    expect(rows(r)).toHaveLength(1);
  });

  it('this device only: no «إخراج كل الأجهزة الأخرى» (improvement d), and it says so', async () => {
    const r = await open(accountApi({ sessions: [THIS_DEVICE] }));
    expect(r.container.textContent).not.toContain('إخراج كل الأجهزة الأخرى');
    expect(r.container.textContent).toContain('لا جهاز آخر داخل بحسابك الآن.');
  });
});
