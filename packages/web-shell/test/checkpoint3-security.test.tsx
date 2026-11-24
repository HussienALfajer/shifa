// Slice A-01-07 checkpoint 3, security review: another person's recovery codes or TOTP key never
// stay on /mfa when the browser's session becomes theirs (L1), and the name above the codes is
// only the person's own; the MFA-rotation exception covers only a session that owed the second
// factor (L3); codes and key are kept out of page translation (L5); a refused recovery code is not
// sent again (I5).
import { afterEach, describe, expect, it } from 'vitest';
import { sessionQueryKey } from '../src/session.ts';
import { button, click, flush, type Rendered, renderShell, type } from './render.tsx';
import { errorAnswer, fakeApi, json, SESSION } from './support.ts';

const KEY = 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP';
const START = { otpauthUri: `otpauth://totp/Shifa:x?secret=${KEY}&issuer=Shifa`, manualKey: KEY };
const CODES = Array.from({ length: 10 }, (_, i) => `abcde-fgh${String(i)}j`);
const ENROL = { ...SESSION, mfa: 'none' as const, mfaRequired: true, tenantId: null };
const VERIFIED = {
  ...SESSION,
  sessionId: '0b6f4c1e-4a43-4f0e-9f61-3c3b1f6f0a99',
  mfa: 'verified' as const,
};
const SOMEONE_ELSE = {
  ...ENROL,
  userId: '0b6f4c1e-4a43-4f0e-9f61-3c3b1f6f0a55',
  sessionId: '0b6f4c1e-4a43-4f0e-9f61-3c3b1f6f0a56',
};

let shown: Rendered | undefined;
afterEach(async () => {
  await shown?.unmount();
  shown = undefined;
});

const text = (r: Rendered) => r.container.textContent;

async function enrolled() {
  const api = fakeApi(ENROL);
  api.answers['/api/me'] = () =>
    json(200, { userId: SESSION.userId, name: 'الأول', phoneE164: '+963930000111' });
  api.answers['/api/auth/mfa/enrol/start'] = () => json(200, START);
  api.answers['/api/auth/mfa/enrol/confirm'] = () => {
    api.session = VERIFIED;
    return json(200, { recoveryCodes: CODES, session: VERIFIED });
  };
  const r = await renderShell('clinic', api, '/mfa');
  shown = r;
  await flush(30);
  await click(button(r.container, 'لديّ التطبيق، التالي'));
  await flush(20);
  return { api, r };
}

describe('security review of checkpoint 3', () => {
  it('L1: the codes go when the session becomes another person’s', async () => {
    const { api, r } = await enrolled();
    await click(button(r.container, 'أضفت الحساب، التالي'));
    const otp = r.container.querySelector<HTMLInputElement>('input[inputmode="numeric"]');
    if (!otp) throw new Error('no code field');
    await type(otp, '123456');
    await flush(40);
    expect(text(r)).toContain(CODES[0]);
    api.session = SOMEONE_ELSE;
    r.queryClient.setQueryData(sessionQueryKey, { kind: 'signed-in', session: SOMEONE_ELSE });
    await flush(60);
    expect(text(r)).not.toContain(CODES[0]);
    expect(document.body.textContent).not.toContain(CODES[0]);
  });

  it('L1: the key goes when the session becomes another person’s', async () => {
    const { api, r } = await enrolled();
    expect(text(r)).toContain('JBSW Y3DP');
    api.session = SOMEONE_ELSE;
    r.queryClient.setQueryData(sessionQueryKey, { kind: 'signed-in', session: SOMEONE_ELSE });
    await flush(60);
    expect(text(r)).not.toContain('JBSW Y3DP');
  });

  it('L3: a staff session without TOTP gets no rotation exception', async () => {
    const staff = { ...SESSION, mfa: 'none' as const, mfaRequired: false };
    const api = fakeApi(staff);
    const r = await renderShell('clinic', api, '/about');
    shown = r;
    await flush(30);
    r.queryClient.setQueryData(['clinic', staff.tenantId, 'probe'], 'cached');
    r.queryClient.setQueryData(sessionQueryKey, { kind: 'signed-in', session: VERIFIED });
    await flush(30);
    expect(r.queryClient.getQueryData(['clinic', staff.tenantId, 'probe'])).toBeUndefined();
  });

  it('L5: the key is kept out of page translation', async () => {
    const { r } = await enrolled();
    const key = [...r.container.querySelectorAll('bdi')].find((b) =>
      b.textContent.includes('JBSW'),
    );
    expect(key?.getAttribute('translate')).toBe('no');
  });

  it('I5: a refused recovery code is not sent again', async () => {
    const api = fakeApi({ ...SESSION, mfa: 'pending' });
    api.answers['/api/auth/mfa/challenge'] = () => errorAnswer(400, 'invalid_code');
    const r = await renderShell('clinic', api, '/mfa');
    shown = r;
    await flush(30);
    await click(button(r.container, 'استخدام رمز استرداد'));
    const input = r.container.querySelector<HTMLInputElement>('input[dir="ltr"]');
    if (!input) throw new Error('no recovery field');
    await type(input, 'wrong-wrong');
    await click(button(r.container, 'تأكيد'));
    await flush(20);
    await click(button(r.container, 'تأكيد'));
    await flush(20);
    expect(api.bodies['/api/auth/mfa/challenge']).toHaveLength(1);
    expect(text(r)).toContain('رمز الاسترداد غير صحيح أو استُعمل من قبل.');
  });
});
