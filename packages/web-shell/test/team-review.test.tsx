// Slice A-01-08 checkpoint 3 review: the member read again when the drawer reopens (B1), a role
// held in an archived branch shown and removable (B2, OD-107), no role editor while the branches
// are unknown (B3), a link retired when the invitation is cancelled (B4), and a switch that came
// back to the new roles' default not stored (non-blocking 2).
import { afterEach, describe, expect, it } from 'vitest';
import { button, click, flush, type Rendered } from './render.tsx';
import { errorAnswer, json } from './support.ts';
import {
  ASSISTANT,
  B_THIRD,
  confirmation,
  control,
  DOCTOR,
  detail,
  drawer,
  hasDrawer,
  memberPath,
  nameLink,
  openTeam,
  RECEPTION,
  roleGroup,
  teamApi,
} from './team-support.ts';

let shown: Rendered | undefined;
afterEach(async () => {
  await shown?.unmount();
  shown = undefined;
});

const LINK = {
  url: 'https://clinic.shifa.test/setup#t=synthetic-review',
  whatsappUrl: 'https://wa.me/?text=synthetic-review',
  expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
};

async function openMember(name: string, api = teamApi()) {
  shown = await openTeam(api);
  await click(nameLink(name));
  await flush(40);
  return shown;
}

const has = (root: HTMLElement, name: string) =>
  [...root.querySelectorAll('button')].some((b) => b.textContent.trim() === name);

describe('Checkpoint 3 review fixes', () => {
  it('B1: a member reopened is read again, not shown from the last read', async () => {
    const api = teamApi();
    await openMember(RECEPTION.name, api);
    expect(has(drawer(), 'تصحيح الرقم')).toBe(true);
    // The person accepted meanwhile.
    const accepted = detail({ ...RECEPTION, status: 'active', linkExpiresAt: null });
    api.answers[memberPath(RECEPTION.id)] = () => json(200, accepted);
    await click(button(drawer(), 'إغلاق'));
    await flush(40);
    expect(hasDrawer()).toBe(false);
    await click(nameLink(RECEPTION.name));
    await flush(40);
    expect(has(drawer(), 'تصحيح الرقم')).toBe(false);
    expect(has(drawer(), 'رابط لكلمة مرور جديدة')).toBe(true);
  });

  it('B2: a role in an archived branch is named and can be removed', async () => {
    const api = teamApi({
      details: {
        [DOCTOR.id]: detail({
          ...DOCTOR,
          roles: [
            ...DOCTOR.roles,
            {
              role: 'doctor',
              branchId: '7a1f4c1e-4a43-4f0e-9f61-3c3b1f6f0e19',
              branchName: 'فرع قديم',
            },
          ],
        }),
      },
    });
    await openMember(DOCTOR.name, api);
    const archived = control(roleGroup('doctor'), 'فرع قديم · مؤرشف');
    await click(archived);
    api.answers[memberPath(DOCTOR.id)] = (body) =>
      body === undefined ? json(200, detail(DOCTOR)) : json(200, detail(DOCTOR));
    await click(button(drawer(), 'حفظ'));
    await flush(40);
    const body = api.bodies[memberPath(DOCTOR.id)]?.at(-1) as { roles?: { branchId: string }[] };
    expect(body.roles?.map((r) => r.branchId)).not.toContain(
      '7a1f4c1e-4a43-4f0e-9f61-3c3b1f6f0e19',
    );
  });

  it('B2: refused for a held archived branch, the drawer says to remove it', async () => {
    const held = detail({
      ...DOCTOR,
      roles: [
        ...DOCTOR.roles,
        {
          role: 'doctor',
          branchId: '7a1f4c1e-4a43-4f0e-9f61-3c3b1f6f0e19',
          branchName: 'فرع قديم',
        },
      ],
    });
    const api = teamApi({ details: { [DOCTOR.id]: held } });
    await openMember(DOCTOR.name, api);
    api.answers[memberPath(DOCTOR.id)] = (body) =>
      body === undefined ? json(200, held) : errorAnswer(409, 'branch_archived');
    await click(control(roleGroup('doctor'), B_THIRD.name));
    await click(button(drawer(), 'حفظ'));
    await flush(40);
    expect(drawer().textContent).toContain('أزل علامة ذلك الفرع');
  });

  it('B3: while the branches failed, no role can be chosen; a retry brings the form', async () => {
    const api = teamApi();
    const answer = api.answers['/api/branches'];
    api.answers['/api/branches'] = () => Promise.reject(new TypeError('offline'));
    shown = await openTeam(api);
    await click(button(shown.container, 'إضافة موظف'));
    await flush(40);
    expect(drawer().querySelector('[data-testid="load-failed"]')).not.toBeNull();
    expect(drawer().querySelector('[data-testid="role-receptionist"]')).toBeNull();
    if (answer) api.answers['/api/branches'] = answer;
    await click(button(drawer(), 'إعادة المحاولة'));
    await flush(60);
    expect(drawer().querySelector('[data-testid="role-receptionist"]')).not.toBeNull();
  });

  it('B4: cancelling the invitation retires the link on screen', async () => {
    const api = teamApi();
    await openMember(RECEPTION.name, api);
    api.answers[`${memberPath(RECEPTION.id)}/setup-link`] = () => json(200, LINK);
    api.answers[`${memberPath(RECEPTION.id)}/deactivate`] = () =>
      json(200, detail({ ...RECEPTION, status: 'deactivated' }));
    await click(button(drawer(), 'إصدار رابط جديد'));
    await click(button(confirmation(), 'إصدار الرابط'));
    await flush(40);
    expect(drawer().querySelector('[data-testid="link-shown"]')).not.toBeNull();
    await click(button(drawer(), 'إلغاء الدعوة'));
    await click(button(confirmation(), 'إلغاء الدعوة'));
    await flush(40);
    expect(drawer().querySelector('[data-testid="link-shown"]')).toBeNull();
    // Nothing unsent is left: the drawer closes without asking.
    await click(button(drawer(), 'إغلاق'));
    await flush(40);
    expect(hasDrawer()).toBe(false);
  });

  it('a switch back at the new roles’ default is not stored (non-blocking 2)', async () => {
    const api = teamApi();
    await openMember(ASSISTANT.name, api);
    api.answers[memberPath(ASSISTANT.id)] = (body) =>
      body === undefined ? json(200, detail(ASSISTANT)) : json(200, detail(ASSISTANT));
    await click(control(drawer(), 'رؤية الملاحظات السريرية'));
    await click(control(roleGroup('assistant'), 'مساعد'));
    await click(control(roleGroup('receptionist'), 'موظف استقبال'));
    await click(control(roleGroup('receptionist'), 'كل الفروع'));
    await click(button(drawer(), 'حفظ'));
    await flush(40);
    const body = api.bodies[memberPath(ASSISTANT.id)]?.at(-1) as { permissions?: unknown };
    expect(body.permissions).toBeUndefined();
  });
});
