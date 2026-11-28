// A-03 criteria 16, 17 (A-03-06): reception fills the clinic's fields on registration and edit.
// Contract rows "Save new" and "Edit" (`fields`).
// - Every type's value is checked on the server with the shared validator; 400 `validation_failed`
//   at `body.fields.<key>`; an unknown or archived key answers 400 there too.
// - A key the member's roles may not edit answers 403 `field_not_editable` with its key.
// - Required only for members who may edit the field (OD-146 point 1); defaults applied on create
//   to editable fields not sent; an archived field is never required.
// - Edit: keys sent are written, `null` clears, keys left out are kept; an older chart without a
//   value of a field made required later can still be edited, clearing it is refused (OD-146 point
//   2); a held archived choice stays, a new pick of it is refused (criterion 17).
// - A replay of the registration with `fields` returns the stored chart; another `fields` is 409.
// - Audit rows name the field keys written, never values or labels.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { testClock } from '../identity/support.ts';
import { activeMember, type Clinic, type TeamWorld, teamWorld } from '../team/support.ts';
import { archiveField, editField, pathsOf } from './fields-support.ts';
import { chartInput, codeOf, edit, patientAudit, register, registered } from './support.ts';
import { chartIn, fieldOf, refusedKeys, storedValues, valueOf } from './values-support.ts';

const clock = testClock();
let world: TeamWorld;
let clinic: Clinic;
let owner: string;
let reception: string;
let doctor: string;

beforeAll(async () => {
  world = await teamWorld(clock, 2026_12_10);
});

/** A clinic per block: archived fields count against the 20 for 30 days. */
async function freshClinic(): Promise<void> {
  clinic = await world.clinic();
  owner = clinic.owner.cookie;
  reception = (await activeMember(world, clinic, [{ role: 'receptionist', branchId: null }]))
    .cookie;
  doctor = (await activeMember(world, clinic, [{ role: 'doctor', branchId: null }])).cookie;
}

afterAll(async () => {
  await world.app.app.close();
});

const registerWith = (cookie: string, fields: Record<string, unknown>) =>
  register(world, cookie, chartInput(world.phone(), { fields }));

describe('values of every type (criterion 16)', () => {
  beforeAll(freshClinic);

  it('stores each type as its shape and answers it on the summary', async () => {
    const text = await fieldOf(world.app, owner, 'text');
    const long = await fieldOf(world.app, owner, 'long_text');
    const number = await fieldOf(world.app, owner, 'number', { validation: { min: 0, max: 99 } });
    const date = await fieldOf(world.app, owner, 'date');
    const single = await fieldOf(world.app, owner, 'single_choice');
    const multi = await fieldOf(world.app, owner, 'multi_choice');
    const yesNo = await fieldOf(world.app, owner, 'yes_no');
    const phone = await fieldOf(world.app, owner, 'phone');
    const [a, b] = multi.options.map((o) => o.id);
    const contact = world.phone();
    const res = await registerWith(reception, {
      [text.key]: '  بطاقة 12  ',
      [long.key]: 'ملاحظة إدارية طويلة',
      [number.key]: 42,
      [date.key]: '2020-01-05',
      [single.key]: single.options[1]?.id,
      [multi.key]: [a, b],
      [yesNo.key]: false,
      [phone.key]: contact.replace('+963', '0'),
    });
    const chart = chartIn(res, 201);
    expect(valueOf(chart, text.key)).toBe('بطاقة 12');
    expect(valueOf(chart, long.key)).toBe('ملاحظة إدارية طويلة');
    expect(valueOf(chart, number.key)).toBe(42);
    expect(valueOf(chart, date.key)).toBe('2020-01-05');
    expect(valueOf(chart, single.key)).toBe(single.options[1]?.id);
    expect(valueOf(chart, multi.key)).toEqual([a, b]);
    expect(valueOf(chart, yesNo.key)).toBe(false);
    expect(valueOf(chart, phone.key)).toBe(contact);
    expect(await storedValues(chart.id)).toHaveLength(8);
  });

  it('answers 400 at `body.fields.<key>` for each misfit, and saves nothing', async () => {
    const number = await fieldOf(world.app, owner, 'number', { validation: { min: 0, max: 99 } });
    const date = await fieldOf(world.app, owner, 'date');
    const single = await fieldOf(world.app, owner, 'single_choice');
    const phone = await fieldOf(world.app, owner, 'phone');
    const res = await registerWith(reception, {
      [number.key]: 120,
      [date.key]: '2020-02-30',
      [single.key]: '0b6f2f4e-5d7a-4c1e-9a3b-2f1e0d9c8b7a',
      [phone.key]: '12',
    });
    expect(res.statusCode, res.body).toBe(400);
    expect(pathsOf(res).sort()).toEqual(
      [number, date, single, phone].map((f) => `body.fields.${f.key}`).sort(),
    );
    const wrongType = await registerWith(reception, { [number.key]: 'اثنان' });
    expect(pathsOf(wrongType)).toEqual([`body.fields.${number.key}`]);
  });

  it('answers 400 for a key that is no active field (unknown, archived)', async () => {
    const gone = await fieldOf(world.app, owner, 'text');
    expect((await archiveField(world.app, owner, gone.key)).statusCode).toBe(200);
    const res = await registerWith(reception, { cf_9999: 'x', [gone.key]: 'y' });
    expect(res.statusCode, res.body).toBe(400);
    expect(pathsOf(res).sort()).toEqual([`body.fields.${gone.key}`, 'body.fields.cf_9999'].sort());
  });
});

describe('who may write (criterion 16)', () => {
  beforeAll(freshClinic);

  it('answers 403 `field_not_editable` with the keys the member may not edit', async () => {
    const ownerOnly = await fieldOf(world.app, owner, 'text', { editRoles: ['owner'] });
    const hidden = await fieldOf(world.app, owner, 'text', {
      viewRoles: ['owner'],
      editRoles: ['owner'],
    });
    const res = await registerWith(reception, { [ownerOnly.key]: 'x', [hidden.key]: 'y' });
    expect(res.statusCode, res.body).toBe(403);
    expect(codeOf(res)).toBe('field_not_editable');
    expect(refusedKeys(res).sort()).toEqual([ownerOnly.key, hidden.key].sort());
    const chart = await registered(world, reception);
    const edited = await edit(world, reception, chart.id, {
      expectedUpdatedAt: chart.updatedAt,
      fields: { [ownerOnly.key]: 'x' },
    });
    expect(edited.statusCode).toBe(403);
    expect(refusedKeys(edited)).toEqual([ownerOnly.key]);
    const byOwner = await edit(world, owner, chart.id, {
      expectedUpdatedAt: chart.updatedAt,
      fields: { [ownerOnly.key]: 'x' },
    });
    expect(valueOf(chartIn(byOwner), ownerOnly.key)).toBe('x');
  });
});

describe('required and default (criterion 17, OD-146 point 1)', () => {
  it('requires a field only of the members who may edit it; defaults fill what is not sent', async () => {
    const required = await fieldOf(world.app, owner, 'text', { required: true });
    const doctorsOnly = await fieldOf(world.app, owner, 'text', {
      required: true,
      editRoles: ['owner', 'doctor'],
    });
    const withDefault = await fieldOf(world.app, owner, 'number', { default: 7 });
    const missing = await registerWith(reception, {});
    expect(missing.statusCode, missing.body).toBe(400);
    expect(pathsOf(missing)).toContain(`body.fields.${required.key}`);
    expect(pathsOf(missing)).not.toContain(`body.fields.${doctorsOnly.key}`);
    const chart = chartIn(await registerWith(reception, { [required.key]: 'تم' }), 201);
    expect(valueOf(chart, withDefault.key)).toBe(7);
    expect(valueOf(chart, doctorsOnly.key)).toBeNull();
    const byDoctor = await registerWith(doctor, {});
    expect(pathsOf(byDoctor)).toContain(`body.fields.${doctorsOnly.key}`);
    expect(pathsOf(byDoctor)).not.toContain(`body.fields.${required.key}`);
    expect((await archiveField(world.app, owner, required.key)).statusCode).toBe(200);
    expect((await archiveField(world.app, owner, doctorsOnly.key)).statusCode).toBe(200);
    chartIn(await registerWith(reception, {}), 201);
    expect((await archiveField(world.app, owner, withDefault.key)).statusCode).toBe(200);
  });
});

describe('edit (contract row "Edit"; OD-146 point 2)', () => {
  beforeAll(freshClinic);

  it('writes the keys sent, clears with null, keeps the keys left out', async () => {
    const one = await fieldOf(world.app, owner, 'text');
    const two = await fieldOf(world.app, owner, 'text');
    const chart = chartIn(await registerWith(reception, { [one.key]: 'أ', [two.key]: 'ب' }), 201);
    const res = await edit(world, reception, chart.id, {
      expectedUpdatedAt: chart.updatedAt,
      fields: { [one.key]: null },
    });
    const after = chartIn(res);
    expect(valueOf(after, one.key)).toBeNull();
    expect(valueOf(after, two.key)).toBe('ب');
    expect(after.updatedAt).not.toBe(chart.updatedAt);
    expect(await storedValues(chart.id)).toHaveLength(1);
    const stale = await edit(world, reception, chart.id, {
      expectedUpdatedAt: chart.updatedAt,
      fields: { [two.key]: 'ج' },
    });
    expect(codeOf(stale)).toBe('stale');
  });

  it('edits an older chart without a value made required later; clearing one is refused', async () => {
    const field = await fieldOf(world.app, owner, 'text');
    const other = await fieldOf(world.app, owner, 'text');
    const older = chartIn(await registerWith(reception, { [other.key]: 'قديم' }), 201);
    const filled = chartIn(await registerWith(reception, { [field.key]: 'قيمة' }), 201);
    const made = await editField(world.app, owner, field.key, {
      expectedUpdatedAt: field.updatedAt,
      required: true,
    });
    expect(made.statusCode, made.body).toBe(200);
    const edited = await edit(world, reception, older.id, {
      expectedUpdatedAt: older.updatedAt,
      fields: { [other.key]: 'جديد', [field.key]: null },
    });
    expect(valueOf(chartIn(edited), other.key)).toBe('جديد');
    const cleared = await edit(world, reception, filled.id, {
      expectedUpdatedAt: filled.updatedAt,
      fields: { [field.key]: null },
    });
    expect(cleared.statusCode).toBe(400);
    expect(pathsOf(cleared)).toEqual([`body.fields.${field.key}`]);
    expect((await archiveField(world.app, owner, field.key)).statusCode).toBe(200);
  });

  it('keeps a held archived choice; a new pick of it is refused (criterion 17)', async () => {
    const field = await fieldOf(world.app, owner, 'single_choice');
    const [held, kept] = field.options;
    const chart = chartIn(await registerWith(reception, { [field.key]: held?.id }), 201);
    const res = await editField(world.app, owner, field.key, {
      expectedUpdatedAt: field.updatedAt,
      options: field.options.map((o) => ({
        id: o.id,
        label: o.label,
        archived: o.id === held?.id,
      })),
    });
    expect(res.statusCode, res.body).toBe(200);
    const again = await edit(world, reception, chart.id, {
      expectedUpdatedAt: chart.updatedAt,
      fields: { [field.key]: held?.id },
    });
    const after = chartIn(again);
    expect(valueOf(after, field.key)).toBe(held?.id);
    expect(after.fields.find((f) => f.key === field.key)?.options).toContainEqual({
      id: held?.id,
      label: held?.label,
      archived: true,
    });
    const fresh = await registerWith(reception, { [field.key]: held?.id });
    expect(pathsOf(fresh)).toEqual([`body.fields.${field.key}`]);
    const moved = await edit(world, reception, chart.id, {
      expectedUpdatedAt: after.updatedAt,
      fields: { [field.key]: kept?.id },
    });
    const now = chartIn(moved);
    const back = await edit(world, reception, chart.id, {
      expectedUpdatedAt: now.updatedAt,
      fields: { [field.key]: held?.id },
    });
    expect(pathsOf(back)).toEqual([`body.fields.${field.key}`]);
  });
});

describe('replay and audit (criterion 3; contract row "Save new")', () => {
  it('a replay with the same fields returns the stored chart; other fields answer 409', async () => {
    const field = await fieldOf(world.app, owner, 'text');
    const input = chartInput(world.phone(), { fields: { [field.key]: 'مرة' } });
    const first = chartIn(await register(world, reception, input), 201);
    const replay = chartIn(await register(world, reception, input), 201);
    expect(replay).toEqual(first);
    const other = await register(world, reception, { ...input, fields: { [field.key]: 'ثانية' } });
    expect(codeOf(other)).toBe('patient_id_taken');
  });

  it('audit rows name the keys written, never a value or a label', async () => {
    const field = await fieldOf(world.app, owner, 'text');
    const chart = chartIn(await registerWith(reception, { [field.key]: 'سري-123' }), 201);
    await edit(world, reception, chart.id, {
      expectedUpdatedAt: chart.updatedAt,
      fields: { [field.key]: 'سري-456' },
    });
    const rows = (await patientAudit(clinic)).filter((r) => r.targetId === chart.id);
    expect(rows.map((r) => [r.event, r.data])).toEqual([
      ['patient.created', { fields: [field.key] }],
      ['patient.edited', { fields: [field.key] }],
    ]);
    const text = JSON.stringify(rows);
    for (const secret of ['سري-123', 'سري-456', field.label]) expect(text).not.toContain(secret);
  });
});
