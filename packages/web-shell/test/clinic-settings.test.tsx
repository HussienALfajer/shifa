// Slice A-01-10 checkpoint 2: «إعدادات العيادة · الخروج التلقائي» (prototype `Account10`). GET and
// PATCH /clinic/settings, owner only: 15, 30 or 60 minutes, each with its use; «حفظ» disabled
// until the value changes (improvement c); saved («يسري من الطلب التالي», the session read again
// so this tab's idle timer takes the new limit); no connection names the value still in force. A
// member has no navigation item and the address takes them to My account.
import { afterEach, describe, expect, it } from 'vitest';
import { accountApi, DOCTOR, openAt } from './account-support.ts';
import { button, click, flush, type Rendered } from './render.tsx';

let shown: Rendered | undefined;
afterEach(async () => {
  await shown?.unmount();
  shown = undefined;
});

async function open(fake: ReturnType<typeof accountApi>) {
  shown = await openAt(fake, '/settings');
  await flush(30);
  return shown;
}

const radio = (r: Rendered, minutes: number) => {
  for (const el of r.container.querySelectorAll('[role="radio"]')) {
    if (el.closest('label')?.textContent.includes(`${String(minutes)} دقيقة`)) return el;
  }
  throw new Error(`no radio for ${String(minutes)}`);
};

describe('Automatic sign-out', () => {
  it('shows the clinic’s value with a use for each choice; «حفظ» waits for a change', async () => {
    const r = await open(accountApi({ idleMinutes: 30 }));
    expect(r.router.state.location.pathname).toBe('/settings');
    expect(r.container.querySelector('h1')?.textContent).toBe('إعدادات العيادة');
    expect(radio(r, 30).getAttribute('aria-checked')).toBe('true');
    expect(r.container.textContent).toContain('لأجهزة الاستقبال المشتركة');
    expect(r.container.textContent).toContain('مشرفو شفاء يخرجون بعد 15 دقيقة دائماً');
    expect(button(r.container, 'حفظ').disabled).toBe(true);
    expect(r.container.querySelector('nav [aria-current="page"]')?.textContent).toContain(
      'إعدادات العيادة',
    );
  });

  it('saves a new value and reads the session again', async () => {
    const fake = accountApi({ idleMinutes: 30 });
    const r = await open(fake);
    await click(radio(r, 15));
    expect(button(r.container, 'حفظ').disabled).toBe(false);
    const reads = fake.calls.filter((c) => c === 'GET /api/auth/session').length;
    await click(button(r.container, 'حفظ'));
    await flush(30);
    expect(fake.bodies['/api/clinic/settings']).toEqual([{ idleMinutes: 15 }]);
    expect(r.container.textContent).toContain('حُفظ: 15 دقيقة');
    expect(r.container.textContent).toContain('يسري على كل من في العيادة من طلبه التالي');
    expect(fake.calls.filter((c) => c === 'GET /api/auth/session').length).toBeGreaterThan(reads);
    expect(button(r.container, 'حفظ').disabled).toBe(true);
  });

  it('no connection: not saved, and the value in force is named', async () => {
    const fake = accountApi({ idleMinutes: 30 });
    const r = await open(fake);
    fake.answers['/api/clinic/settings'] = () => Promise.reject(new TypeError('offline'));
    await click(radio(r, 60));
    await click(button(r.container, 'حفظ'));
    await flush(30);
    expect(r.container.textContent).toContain('لم يُحفظ');
    expect(r.container.textContent).toContain('ما زالت المدة 30 دقيقة');
  });

  it('a member is taken to My account and never reads the setting', async () => {
    const fake = accountApi({ session: DOCTOR });
    const r = await open(fake);
    expect(r.router.state.location.pathname).toBe('/account');
    expect(fake.calls).not.toContain('GET /api/clinic/settings');
  });
});
