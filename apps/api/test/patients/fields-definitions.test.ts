// A-03 criteria 14, 16 (view and edit roles of the definitions), 37, 39 (A-03-05). Contract rows
// `GET /patients/fields` (the member's view), `GET /patients/fields/definitions` (the owner's
// view), `POST /patients/fields` and `PATCH /patients/fields/:key`.
// - Every type with its rules and default; the key `cf_…` is generated; the type is fixed.
// - A choice field has 2 to 250 choices, unique after Arabic folding, renamed or archived and never
//   deleted; active field labels are unique after folding.
// - A text pattern is a preset or a custom expression; an unsafe or invalid one is refused.
// - A sensitive field is not searchable; the edit roles are a subset of the view roles.
// - The member's view holds the active fields their roles may view, with `editable`.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { testClock } from '../identity/support.ts';
import { activeMember, type Clinic, get, type TeamWorld, teamWorld } from '../team/support.ts';
import {
  archiveField,
  created,
  createField,
  definitions,
  editField,
  type FieldDefinition,
  formFields,
  pathsOf,
  textField,
} from './fields-support.ts';
import { codeOf } from './support.ts';

const clock = testClock();
let world: TeamWorld;
let clinic: Clinic;
let owner: string;
let reception: Awaited<ReturnType<typeof activeMember>>;
let accountant: Awaited<ReturnType<typeof activeMember>>;

beforeAll(async () => {
  world = await teamWorld(clock, 2026_12_07);
  clinic = await world.clinic();
  owner = clinic.owner.cookie;
  reception = await activeMember(world, clinic, [{ role: 'receptionist', branchId: null }]);
  accountant = await activeMember(world, clinic, [{ role: 'accountant', branchId: null }]);
});

afterAll(async () => {
  await world.app.app.close();
});

const NONE = { minLength: null, maxLength: null, min: null, max: null, pattern: null };

async function refused(body: Record<string, unknown>): Promise<string[]> {
  const res = await createField(world.app, owner, textField(body));
  expect(res.statusCode, res.body).toBe(400);
  expect(codeOf(res)).toBe('validation_failed');
  return pathsOf(res);
}

describe('a field of each type (criterion 14)', () => {
  it('stores a text field with its lengths, a preset shape and a default; the key is generated', async () => {
    const field = await created(world.app, owner, {
      labelEn: 'Insurance card',
      validation: { minLength: 4, maxLength: 12, pattern: { preset: 'digits', expression: null } },
      default: '0000',
      required: true,
      print: true,
    });
    expect(field.key).toMatch(/^cf_[0-9]+$/);
    expect(field).toMatchObject({
      labelEn: 'Insurance card',
      type: 'text',
      required: true,
      validation: { ...NONE, minLength: 4, maxLength: 12, pattern: { preset: 'digits' } },
      default: '0000',
      sensitive: false,
      searchable: false,
      print: true,
      state: 'active',
      archivedAt: null,
      purgeAt: null,
      options: [],
    });
  });

  it('stores a long text, a number with its range, a date, yes/no and a phone', async () => {
    const long = await created(world.app, owner, {
      type: 'long_text',
      validation: { maxLength: 1000 },
    });
    expect(long.validation).toEqual({ ...NONE, maxLength: 1000 });
    const number = await created(world.app, owner, {
      type: 'number',
      validation: { min: 0, max: 300 },
      default: 70,
    });
    expect(number).toMatchObject({ validation: { ...NONE, min: 0, max: 300 }, default: 70 });
    const date = await created(world.app, owner, { type: 'date', default: '2026-01-01' });
    expect(date.default).toBe('2026-01-01');
    const yesNo = await created(world.app, owner, { type: 'yes_no', default: false });
    expect(yesNo.default).toBe(false);
    const phone = await created(world.app, owner, { type: 'phone', default: '0930012345' });
    expect(phone.default).toBe('+963930012345');
  });

  it('stores choices in order, with a default named by its label and answered by its id', async () => {
    const single = await created(world.app, owner, {
      type: 'single_choice',
      options: [{ label: 'نقدي' }, { label: 'تأمين' }, { label: 'جمعية' }],
      default: 'تأمين',
    });
    expect(single.options.map((o) => [o.label, o.order, o.archived])).toEqual([
      ['نقدي', 0, false],
      ['تأمين', 1, false],
      ['جمعية', 2, false],
    ]);
    expect(single.default).toBe(single.options[1]?.id);
    const multi = await created(world.app, owner, {
      type: 'multi_choice',
      options: [{ label: 'صباحًا' }, { label: 'مساءً' }],
      default: ['صباحًا', 'مساءً'],
    });
    expect(multi.default).toEqual(multi.options.map((o) => o.id));
  });

  it('gives every new field a key never held before', async () => {
    const keys = (await definitions(world.app, owner)).fields.map((f) => f.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe('rules that do not fit the type (criteria 14, 39)', () => {
  it('refuses a range on a text, a length on a number and a pattern on a long text', async () => {
    expect(await refused({ validation: { min: 1 } })).toContain('body.validation.min');
    expect(await refused({ type: 'number', validation: { maxLength: 3 } })).toContain(
      'body.validation.maxLength',
    );
    expect(
      await refused({
        type: 'long_text',
        validation: { pattern: { preset: 'digits', expression: null } },
      }),
    ).toContain('body.validation.pattern');
  });

  it('refuses a minimum above the maximum and a length past the type’s cap', async () => {
    expect(await refused({ validation: { minLength: 9, maxLength: 3 } })).toContain(
      'body.validation.minLength',
    );
    expect(await refused({ type: 'number', validation: { min: 10, max: 1 } })).toContain(
      'body.validation.min',
    );
    expect(await refused({ validation: { maxLength: 201 } })).toContain(
      'body.validation.maxLength',
    );
  });

  it('refuses a default its own rules refuse', async () => {
    expect(await refused({ validation: { maxLength: 3 }, default: 'أربعة' })).toContain(
      'body.default',
    );
    expect(await refused({ type: 'number', default: 'سبعون' })).toContain('body.default');
    expect(
      await refused({
        type: 'single_choice',
        options: [{ label: 'أ' }, { label: 'ب' }],
        default: 'ج',
      }),
    ).toContain('body.default');
  });

  it('takes a custom expression and refuses an unsafe or invalid one (criterion 39)', async () => {
    const field = await created(world.app, owner, {
      validation: { pattern: { preset: 'custom', expression: '[A-Z]{2}-[0-9]{4}' } },
    });
    expect(field.validation.pattern).toEqual({ preset: 'custom', expression: '[A-Z]{2}-[0-9]{4}' });
    for (const expression of ['(a)\\1', '(?=a)a', '[a-', 'a'.repeat(101)]) {
      expect(
        await refused({ validation: { pattern: { preset: 'custom', expression } } }),
        expression,
      ).toContain('body.validation.pattern');
    }
    expect(
      await refused({ validation: { pattern: { preset: 'custom', expression: null } } }),
    ).toContain('body.validation.pattern');
  });
});

describe('choices (criteria 14, 37)', () => {
  it('needs at least 2 choices, unique after folding, and none on other types', async () => {
    const one = [{ label: 'نعم' }];
    expect(await refused({ type: 'single_choice', options: one })).toContain('body.options');
    const folded = [{ label: 'أزرق' }, { label: 'ازرق' }];
    expect(await refused({ type: 'multi_choice', options: folded })).toContain('body.options');
    expect(await refused({ options: [{ label: 'أ' }, { label: 'ب' }] })).toContain('body.options');
  });

  it('takes 250 choices', async () => {
    const options = Array.from({ length: 250 }, (_, i) => ({ label: `خيار ${String(i + 1)}` }));
    const field = await created(world.app, owner, { type: 'single_choice', options });
    expect(field.options).toHaveLength(250);
  });

  it('renames, reorders, archives and adds choices, and never deletes one', async () => {
    const field = await created(world.app, owner, {
      type: 'single_choice',
      options: [{ label: 'أول' }, { label: 'ثان' }, { label: 'ثالث' }],
    });
    const [first, second, third] = field.options;
    if (!first || !second || !third) throw new Error('three options expected');
    const res = await editField(world.app, owner, field.key, {
      expectedUpdatedAt: field.updatedAt,
      options: [
        { id: third.id, label: 'ثالث' },
        { id: first.id, label: 'الأول' },
        { id: second.id, label: 'ثان', archived: true },
        { label: 'رابع' },
      ],
    });
    expect(res.statusCode, res.body).toBe(200);
    const edited = res.json<FieldDefinition>();
    expect(edited.options.map((o) => [o.label, o.order, o.archived])).toEqual([
      ['ثالث', 0, false],
      ['الأول', 1, false],
      ['ثان', 2, true],
      ['رابع', 3, false],
    ]);
    expect(edited.options[1]?.id).toBe(first.id);
    const dropped = await editField(world.app, owner, field.key, {
      expectedUpdatedAt: edited.updatedAt,
      options: edited.options.filter((o) => o.id !== third.id),
    });
    expect(dropped.statusCode, dropped.body).toBe(400);
    expect(pathsOf(dropped)).toContain('body.options');
  });

  it('keeps 2 active choices: archiving below that is refused', async () => {
    const field = await created(world.app, owner, {
      type: 'single_choice',
      options: [{ label: 'هذا' }, { label: 'ذاك' }],
    });
    const res = await editField(world.app, owner, field.key, {
      expectedUpdatedAt: field.updatedAt,
      options: field.options.map((o, i) => ({ id: o.id, label: o.label, archived: i === 0 })),
    });
    expect(res.statusCode, res.body).toBe(400);
    expect(pathsOf(res)).toContain('body.options');
  });
});

describe('labels, roles and flags (criteria 14, 15, 37)', () => {
  it('refuses a label an active field holds after folding, and frees it on archive', async () => {
    const field = await created(world.app, owner, { label: 'رقم البطاقة' });
    expect(await refused({ label: 'رَقم البطاقة' })).toContain('body.label');
    expect((await archiveField(world.app, owner, field.key)).statusCode).toBe(200);
    expect(
      (await createField(world.app, owner, textField({ label: 'رقم البطاقة' }))).statusCode,
    ).toBe(201);
  });

  it('refuses edit roles outside the view roles', async () => {
    expect(await refused({ viewRoles: ['owner'], editRoles: ['owner', 'receptionist'] })).toContain(
      'body.editRoles',
    );
  });

  it('refuses a sensitive field that is searchable, on create and on edit', async () => {
    expect(await refused({ sensitive: true, searchable: true })).toContain('body.searchable');
    const field = await created(world.app, owner, { sensitive: true });
    const res = await editField(world.app, owner, field.key, {
      expectedUpdatedAt: field.updatedAt,
      searchable: true,
    });
    expect(res.statusCode, res.body).toBe(400);
    expect(pathsOf(res)).toContain('body.searchable');
  });
});

describe('an edit (contract row "Edit")', () => {
  it('answers 400 `type_fixed` to a type sent, and 409 `stale` after another save', async () => {
    const field = await created(world.app, owner);
    const typed = await editField(world.app, owner, field.key, {
      expectedUpdatedAt: field.updatedAt,
      type: 'number',
    });
    expect(typed.statusCode, typed.body).toBe(400);
    expect(codeOf(typed)).toBe('type_fixed');
    const saved = await editField(world.app, owner, field.key, {
      expectedUpdatedAt: field.updatedAt,
      required: true,
      label: `${field.label} أ`,
    });
    expect(saved.statusCode, saved.body).toBe(200);
    expect(saved.json<FieldDefinition>()).toMatchObject({ required: true, type: 'text' });
    const late = await editField(world.app, owner, field.key, {
      expectedUpdatedAt: field.updatedAt,
      required: false,
    });
    expect(late.statusCode, late.body).toBe(409);
    expect(codeOf(late)).toBe('stale');
  });

  it('answers 404 for a key the clinic does not hold', async () => {
    const res = await editField(world.app, owner, 'cf_99999', {
      expectedUpdatedAt: new Date().toISOString(),
      required: true,
    });
    expect(res.statusCode).toBe(404);
  });
});

describe('the member’s view (contract row `GET /patients/fields`, criterion 16)', () => {
  it('holds the active fields their roles may view, with `editable`, active choices only', async () => {
    const shared = await created(world.app, owner, {
      type: 'single_choice',
      options: [{ label: 'باق' }, { label: 'مؤرشف' }, { label: 'آخر' }],
      viewRoles: ['owner', 'receptionist', 'accountant'],
      editRoles: ['owner', 'receptionist'],
    });
    const ownerOnly = await created(world.app, owner, { viewRoles: ['owner'], editRoles: [] });
    const gone = await created(world.app, owner);
    await archiveField(world.app, owner, gone.key);
    const withArchived = await editField(world.app, owner, shared.key, {
      expectedUpdatedAt: shared.updatedAt,
      options: shared.options.map((o, i) => ({ id: o.id, label: o.label, archived: i === 1 })),
    });
    expect(withArchived.statusCode, withArchived.body).toBe(200);

    const theirs = await formFields(world.app, reception.cookie);
    const keys = theirs.map((f) => f.key);
    expect(keys).toContain(shared.key);
    expect(keys).not.toContain(ownerOnly.key);
    expect(keys).not.toContain(gone.key);
    const field = theirs.find((f) => f.key === shared.key);
    expect(field).toMatchObject({ editable: true, sensitive: false, type: 'single_choice' });
    expect(field?.options.map((o) => o.label)).toEqual(['باق', 'آخر']);
    expect(field).not.toHaveProperty('viewRoles');
    expect(field).not.toHaveProperty('searchable');

    const read = (await formFields(world.app, accountant.cookie)).find((f) => f.key === shared.key);
    expect(read?.editable).toBe(false);
  });

  it('lists the owner’s view by section in creation order, then by order', async () => {
    // A clinic of its own: the file's clinic is at its 20 fields by now.
    const fresh = (await world.clinic()).owner.cookie;
    await created(world.app, fresh);
    const before = (await definitions(world.app, fresh)).fields.length;
    const later = await created(world.app, fresh, { section: 'قسم ثان' });
    const back = await created(world.app, fresh);
    const { fields } = await definitions(world.app, fresh);
    expect(fields).toHaveLength(before + 2);
    const sections = [...new Set(fields.map((f) => f.section))];
    expect(sections).toEqual(['معلومات إدارية', 'قسم ثان']);
    const inFirst = fields.filter((f) => f.section === 'معلومات إدارية');
    expect(inFirst.at(-1)?.key).toBe(back.key);
    expect(inFirst.map((f) => f.order)).toEqual(inFirst.map((_, i) => i));
    expect(fields.at(-1)?.key).toBe(later.key);
  });
});

describe('access', () => {
  it('keeps the definitions to the owner; the member’s view to every clinic role', async () => {
    expect(
      (await get(world.app, '/patients/fields/definitions', reception.cookie)).statusCode,
    ).toBe(403);
    expect((await createField(world.app, reception.cookie, textField())).statusCode).toBe(403);
    expect((await get(world.app, '/patients/fields', accountant.cookie)).statusCode).toBe(200);
  });

  it('shows another clinic none of these fields, and refuses its owner an edit', async () => {
    // A clinic of its own: the file's clinic is at its 20 fields by now.
    const mine = await created(world.app, (await world.clinic()).owner.cookie);
    const other = await world.clinic();
    expect((await definitions(world.app, other.owner.cookie)).fields).toEqual([]);
    expect(await formFields(world.app, other.owner.cookie)).toEqual([]);
    const res = await editField(world.app, other.owner.cookie, mine.key, {
      expectedUpdatedAt: mine.updatedAt,
      required: true,
    });
    expect(res.statusCode).toBe(404);
  });
});
