// A-03 criteria 15, 17, 20 (field events), 38 (A-03-05). Contract rows `PUT /patients/fields/order`,
// archive and restore, `limits` in `GET /patients/fields/definitions` and the `limits.custom_fields`
// use in `GET /clinic/capabilities` (and the super admin's entitlements).
// - 20 fields: active ones and those archived within 30 days; one more answers 409
//   `limit_reached`. At most 5 searchable (409 `searchable_limit`).
// - Fields move within their section only; the order sends `expectedUpdatedAt`.
// - Archived fields restore within 30 days; on day 31 they are purged (fake clock), stop
//   counting, and their keys are never given again.
// - Audit rows per event hold no label.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { testClock } from '../identity/support.ts';
import { type Clinic, get, type TeamWorld, teamWorld } from '../team/support.ts';
import {
  archiveField,
  created,
  createField,
  DAY_MS,
  definitions,
  editField,
  type FieldDefinition,
  fieldAudit,
  orderFields,
  ownerAgain,
  pathsOf,
  restoreField,
  textField,
} from './fields-support.ts';
import { codeOf } from './support.ts';

const clock = testClock();
let world: TeamWorld;

beforeAll(async () => {
  world = await teamWorld(clock, 2026_12_08);
});

afterAll(async () => {
  await world.app.app.close();
});

const customFieldsUse = async (cookie: string) => {
  const res = await get(world.app, '/clinic/capabilities', cookie);
  expect(res.statusCode, res.body).toBe(200);
  return res
    .json<{ limits: { key: string; limit: number; used: number | null }[] }>()
    .limits.find((l) => l.key === 'limits.custom_fields');
};

const adminUse = async (clinic: Clinic) => {
  const res = await get(
    world.app,
    `/platform/clinics/${clinic.clinicId}/entitlements`,
    world.admin.cookie,
  );
  expect(res.statusCode, res.body).toBe(200);
  return res
    .json<{ items: { key: string; used: number | null }[] }>()
    .items.find((i) => i.key === 'limits.custom_fields')?.used;
};

describe('the limit of 20 (criterion 15)', () => {
  it('counts fields archived within 30 days, answers 409 at the 21st and reports the use', async () => {
    const clinic = await world.clinic();
    const owner = clinic.owner.cookie;
    expect(await customFieldsUse(owner)).toEqual({
      key: 'limits.custom_fields',
      limit: 20,
      used: 0,
    });
    expect(await adminUse(clinic)).toBe(0);
    const fields: FieldDefinition[] = [];
    for (let i = 0; i < 20; i += 1) fields.push(await created(world.app, owner));
    const first = fields[0];
    if (!first) throw new Error('fields expected');
    expect((await archiveField(world.app, owner, first.key)).statusCode).toBe(200);

    const res = await createField(world.app, owner, textField());
    expect(res.statusCode, res.body).toBe(409);
    expect(codeOf(res)).toBe('limit_reached');
    expect(res.json<{ error: { limitReached: unknown } }>().error.limitReached).toEqual({
      key: 'limits.custom_fields',
      limit: 20,
      used: 20,
    });
    expect((await definitions(world.app, owner)).limits).toMatchObject({ used: 20, max: 20 });
    expect((await customFieldsUse(owner))?.used).toBe(20);
    expect(await adminUse(clinic)).toBe(20);
  });

  it('lets two racing adds at the limit write one field only', async () => {
    const clinic = await world.clinic();
    const owner = clinic.owner.cookie;
    for (let i = 0; i < 19; i += 1) await created(world.app, owner);
    const answers = await Promise.all([
      createField(world.app, owner, textField()),
      createField(world.app, owner, textField()),
    ]);
    expect(answers.map((r) => r.statusCode).sort()).toEqual([201, 409]);
    expect((await definitions(world.app, owner)).limits.used).toBe(20);
  });
});

describe('searchable fields (criterion 15)', () => {
  it('takes 5, answers 409 `searchable_limit` at the 6th, and frees a slot on archive', async () => {
    const clinic = await world.clinic();
    const owner = clinic.owner.cookie;
    const searchable: FieldDefinition[] = [];
    for (let i = 0; i < 5; i += 1) {
      searchable.push(await created(world.app, owner, { searchable: true }));
    }
    const sixth = await createField(world.app, owner, textField({ searchable: true }));
    expect(sixth.statusCode, sixth.body).toBe(409);
    expect(codeOf(sixth)).toBe('searchable_limit');
    const plain = await created(world.app, owner);
    const edited = await editField(world.app, owner, plain.key, {
      expectedUpdatedAt: plain.updatedAt,
      searchable: true,
    });
    expect(edited.statusCode, edited.body).toBe(409);
    expect(codeOf(edited)).toBe('searchable_limit');
    expect((await definitions(world.app, owner)).limits).toMatchObject({
      searchableUsed: 5,
      searchableMax: 5,
    });

    const [one] = searchable;
    if (!one) throw new Error('a searchable field expected');
    await archiveField(world.app, owner, one.key);
    expect((await createField(world.app, owner, textField({ searchable: true }))).statusCode).toBe(
      201,
    );
    // Restoring it would make a sixth.
    const back = await restoreField(world.app, owner, one.key);
    expect(back.statusCode, back.body).toBe(409);
    expect(codeOf(back)).toBe('searchable_limit');
  });
});

describe('the order within a section (criterion 38)', () => {
  it('moves fields within their section, refuses a move across and a stale list', async () => {
    const clinic = await world.clinic();
    const owner = clinic.owner.cookie;
    const a = await created(world.app, owner, { section: 'أ' });
    const b = await created(world.app, owner, { section: 'أ' });
    const c = await created(world.app, owner, { section: 'ب' });
    const list = await definitions(world.app, owner);
    const res = await orderFields(world.app, owner, {
      expectedUpdatedAt: list.listUpdatedAt,
      sections: [
        { title: 'أ', keys: [b.key, a.key] },
        { title: 'ب', keys: [c.key] },
      ],
    });
    expect(res.statusCode, res.body).toBe(200);
    const after = await definitions(world.app, owner);
    expect(after.fields.map((f) => [f.key, f.order])).toEqual([
      [b.key, 0],
      [a.key, 1],
      [c.key, 0],
    ]);

    const across = await orderFields(world.app, owner, {
      expectedUpdatedAt: after.listUpdatedAt,
      sections: [
        { title: 'أ', keys: [b.key] },
        { title: 'ب', keys: [a.key, c.key] },
      ],
    });
    expect(across.statusCode, across.body).toBe(400);
    expect(pathsOf(across)).toContain('body.sections');
    const missing = await orderFields(world.app, owner, {
      expectedUpdatedAt: after.listUpdatedAt,
      sections: [{ title: 'أ', keys: [b.key, a.key] }],
    });
    expect(missing.statusCode, missing.body).toBe(400);
    const stale = await orderFields(world.app, owner, {
      expectedUpdatedAt: list.listUpdatedAt,
      sections: [
        { title: 'أ', keys: [a.key, b.key] },
        { title: 'ب', keys: [c.key] },
      ],
    });
    expect(stale.statusCode, stale.body).toBe(409);
    expect(codeOf(stale)).toBe('stale');
  });
});

describe('audit (criterion 20)', () => {
  it('writes one row per event with ids and changed keys only, never a label', async () => {
    const clinic = await world.clinic();
    const owner = clinic.owner.cookie;
    const field = await created(world.app, owner, {
      label: 'رقم الجمعية الخيرية',
      labelEn: 'Charity number',
    });
    const edited = await editField(world.app, owner, field.key, {
      expectedUpdatedAt: field.updatedAt,
      label: 'رقم الجمعية',
      required: true,
    });
    expect(edited.statusCode, edited.body).toBe(200);
    await archiveField(world.app, owner, field.key);
    await restoreField(world.app, owner, field.key);
    const rows = await fieldAudit(clinic);
    expect(rows.map((r) => r.event)).toEqual([
      'patient_field.created',
      'patient_field.edited',
      'patient_field.archived',
      'patient_field.restored',
    ]);
    for (const row of rows) expect(row.actorId).not.toBeNull();
    expect(new Set(rows.map((r) => r.targetId)).size).toBe(1);
    expect(rows[1]?.data).toEqual({ key: field.key, changed: ['label', 'required'] });
    const text = JSON.stringify(rows);
    for (const label of ['رقم الجمعية', 'Charity number']) expect(text).not.toContain(label);
  });
});

// Last: it moves the clock 31 days, past every session the world opened (the super admin's too).
describe('archive, restore and purge (criterion 17)', () => {
  it('restores on day 29, purges on day 31, frees the limit and never gives a key again', async () => {
    const clinic = await world.clinic();
    let owner = clinic.owner.cookie;
    const kept = await created(world.app, owner, { required: true });
    const purged = await created(world.app, owner);

    const archived = await archiveField(world.app, owner, kept.key);
    expect(archived.statusCode, archived.body).toBe(200);
    const view = archived.json<FieldDefinition>();
    expect(view.state).toBe('archived');
    expect(view.archivedAt).not.toBeNull();
    expect(Date.parse(view.purgeAt ?? '') - Date.parse(view.archivedAt ?? '')).toBe(30 * DAY_MS);
    await archiveField(world.app, owner, purged.key);

    clock.advanceBy(29 * DAY_MS);
    owner = await ownerAgain(world, clinic);
    const restored = await restoreField(world.app, owner, kept.key);
    expect(restored.statusCode, restored.body).toBe(200);
    expect(restored.json<FieldDefinition>()).toMatchObject({
      state: 'active',
      archivedAt: null,
      purgeAt: null,
    });
    expect((await definitions(world.app, owner)).limits.used).toBe(2);

    clock.advanceBy(2 * DAY_MS);
    owner = await ownerAgain(world, clinic);
    const list = await definitions(world.app, owner);
    expect(list.fields.map((f) => f.key)).toEqual([kept.key]);
    expect(list.limits.used).toBe(1);
    expect((await customFieldsUse(owner))?.used).toBe(1);
    expect((await restoreField(world.app, owner, purged.key)).statusCode).toBe(404);
    expect((await archiveField(world.app, owner, purged.key)).statusCode).toBe(404);

    const next = await created(world.app, owner, { label: purged.label });
    expect([kept.key, purged.key]).not.toContain(next.key);
    const purges = (await fieldAudit(clinic)).filter((r) => r.event === 'patient_field.purged');
    expect(purges.map((r) => r.data)).toEqual([{ key: purged.key }]);
  });
});
