// A-03 criteria 4, 16 (A-03-06): each member sees only the fields their roles may view; sensitive
// values stay on the summary; searchable values join the search box. Contract rows "Summary"
// (`fields[]` on every answer that returns a chart: create, edit, archive, restore, read) and
// "Results" (`matchedBy: custom_field`).
// - Per role (owner, reception, doctor, accountant): the viewable active fields, by section and
//   order, empty ones with `value: null`; an archived field is not shown.
// - `PatientCard` answers (search, family, duplicate candidates, the 409 `possible_duplicate`)
//   carry no `fields` and no value.
// - Search by a searchable value (phone in any format, OD-146 point 4); an unsearchable, archived
//   or unviewable field does not match; a field made unsearchable stops matching at once.
import { PatientChart, PatientSearchResults } from '@shifa/contracts';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { testClock } from '../identity/support.ts';
import { activeMember, type Clinic, type TeamWorld, teamWorld } from '../team/support.ts';
import { archiveField, editField } from './fields-support.ts';
import {
  archive,
  chartInput,
  chartOf,
  codeOf,
  edit,
  familyOf,
  found,
  register,
  registered,
  restore,
  search,
} from './support.ts';
import { chartIn, fieldOf, keysOf, valueOf } from './values-support.ts';

const clock = testClock();
let world: TeamWorld;
let clinic: Clinic;
let owner: string;
let reception: string;
let doctor: string;
let accountant: string;

beforeAll(async () => {
  world = await teamWorld(clock, 2026_12_11);
  clinic = await world.clinic();
  owner = clinic.owner.cookie;
  const member = async (role: 'receptionist' | 'doctor' | 'accountant') =>
    (await activeMember(world, clinic, [{ role, branchId: null }])).cookie;
  reception = await member('receptionist');
  doctor = await member('doctor');
  accountant = await member('accountant');
});

afterAll(async () => {
  await world.app.app.close();
});

describe('the summary per role (criterion 16)', () => {
  it('shows each member the fields their roles may view, on every answer', async () => {
    const shared = await fieldOf(world.app, owner, 'text', { section: 'إداري' });
    const money = await fieldOf(world.app, owner, 'text', {
      section: 'مالي',
      sensitive: true,
      viewRoles: ['owner', 'accountant'],
      editRoles: ['owner'],
    });
    const clinical = await fieldOf(world.app, owner, 'yes_no', {
      section: 'سريري',
      viewRoles: ['owner', 'doctor'],
      editRoles: ['owner', 'doctor'],
    });
    const empty = await fieldOf(world.app, owner, 'number', { section: 'إداري' });
    const input = chartInput(world.phone(), {
      fields: { [shared.key]: 'مشترك', [money.key]: 'دين 500', [clinical.key]: true },
    });
    const created = chartIn(await register(world, owner, input), 201);
    expect(keysOf(created)).toEqual([shared.key, empty.key, money.key, clinical.key]);
    expect(created.fields[1]).toMatchObject({ section: 'إداري', order: 1, value: null });
    expect(created.fields.find((f) => f.key === money.key)?.sensitive).toBe(true);
    PatientChart.parse(created);

    const views = {
      reception: [shared.key, empty.key],
      doctor: [shared.key, empty.key, clinical.key],
      accountant: [shared.key, empty.key, money.key],
    };
    const cookies = { reception, doctor, accountant };
    for (const [role, keys] of Object.entries(views)) {
      const read = chartIn(await chartOf(world, cookies[role as keyof typeof cookies], created.id));
      expect(keysOf(read), role).toEqual(keys);
      expect(JSON.stringify(read).includes('دين 500'), role).toBe(role === 'accountant');
    }

    const edited = chartIn(
      await edit(world, reception, created.id, {
        expectedUpdatedAt: created.updatedAt,
        fields: { [shared.key]: 'معدل' },
      }),
    );
    expect(keysOf(edited)).toEqual(views.reception);
    expect(valueOf(edited, shared.key)).toBe('معدل');
    const archived = chartIn(await archive(world, owner, created.id, edited.updatedAt));
    expect(valueOf(archived, money.key)).toBe('دين 500');
    const restored = chartIn(await restore(world, owner, created.id, archived.updatedAt));
    expect(keysOf(restored)).toEqual(keysOf(created));

    // Only the registrar replays (security review M1; field-values-review.test.ts).
    const replay = chartIn(await register(world, owner, input), 201);
    expect(keysOf(replay)).toEqual(keysOf(created));

    expect((await archiveField(world.app, owner, empty.key)).statusCode).toBe(200);
    const after = chartIn(await chartOf(world, owner, created.id));
    expect(keysOf(after)).not.toContain(empty.key);
  });
});

describe('cards carry no values (criterion 16)', () => {
  it('search, family, duplicates and the 409 hold no field and no sensitive value', async () => {
    const secret = await fieldOf(world.app, owner, 'text', {
      sensitive: true,
      viewRoles: ['owner', 'receptionist'],
    });
    const phone = world.phone();
    const first = await registered(world, owner, {
      contactPhone: phone,
      fields: { [secret.key]: 'سر-خاص-1' },
    });
    const twin = chartInput(phone, {
      givenName: first.givenName,
      fatherName: first.fatherName,
      familyName: first.familyName,
      fields: { [secret.key]: 'سر-خاص-2' },
    });
    const duplicate = await register(world, owner, twin);
    expect(codeOf(duplicate)).toBe('possible_duplicate');
    const results = await found(world, owner, String(first.fileNumber));
    const family = await familyOf(world, owner, { phone });
    expect(family.statusCode, family.body).toBe(200);
    for (const [name, text] of Object.entries({
      duplicate: duplicate.body,
      search: JSON.stringify(results),
      family: family.body,
    })) {
      expect(text.includes('سر-خاص'), name).toBe(false);
      expect(text.includes('"fields"'), name).toBe(false);
    }
  });
});

describe('search by a value (criterion 4; OD-146 points 3, 4)', () => {
  it('finds a chart by a searchable value; nothing else matches', async () => {
    const card = await fieldOf(world.app, owner, 'text', { searchable: true });
    const other = await fieldOf(world.app, owner, 'phone', { searchable: true });
    const plain = await fieldOf(world.app, owner, 'text');
    const ownerOnly = await fieldOf(world.app, owner, 'number', {
      searchable: true,
      viewRoles: ['owner'],
      editRoles: ['owner'],
    });
    const otherPhone = world.phone();
    const chart = await registered(world, owner, {
      fields: {
        [card.key]: 'بطاقة تأمين ٧',
        [other.key]: otherPhone,
        [plain.key]: 'قيمة عادية',
        [ownerOnly.key]: 8_800_123,
      },
    });
    const ids = (r: { results: { id: string; matchedBy: string }[] }) =>
      r.results.filter((h) => h.matchedBy === 'custom_field').map((h) => h.id);

    const byCard = await found(world, reception, 'بطاقه تامين 7');
    expect(ids(byCard)).toEqual([chart.id]);
    PatientSearchResults.parse(byCard);
    expect(ids(await found(world, reception, otherPhone.replace('+963', '0')))).toEqual([chart.id]);
    expect(ids(await found(world, reception, otherPhone.slice(-7)))).toEqual([]);
    expect(ids(await found(world, reception, 'قيمة عادية'))).toEqual([]);
    expect(ids(await found(world, reception, '8800123'))).toEqual([]);
    expect(ids(await found(world, owner, '8800123'))).toEqual([chart.id]);

    const off = await editField(world.app, owner, card.key, {
      expectedUpdatedAt: card.updatedAt,
      searchable: false,
    });
    expect(off.statusCode, off.body).toBe(200);
    expect(ids(await found(world, reception, 'بطاقه تامين 7'))).toEqual([]);
    expect((await archiveField(world.app, owner, other.key)).statusCode).toBe(200);
    expect(ids(await found(world, reception, otherPhone))).toEqual([]);
  });

  it('refuses `searchable` on choices and yes/no (OD-146 point 3)', async () => {
    for (const type of ['single_choice', 'multi_choice', 'yes_no']) {
      const res = await fieldOf(world.app, owner, type, { searchable: true }).catch(
        (err: unknown) => err,
      );
      expect(res instanceof Error ? res.message : 'created', type).toContain('400');
    }
    const res = await search(world, reception, { term: 'نعم' });
    expect(res.statusCode).toBe(200);
  });
});
