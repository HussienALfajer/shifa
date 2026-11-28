// A-03-06 review findings.
// - Security M1: only the member who registered a chart replays it; another member's resend of
//   the same id answers 409 `patient_id_taken` whatever `fields` it guesses.
// - N2: a retry sending its field keys in another order is still a replay.
// - B1 / L1: the largest values the validator accepts (250 picked choices, 2,000 characters of
//   4 bytes) are stored, never a 500.
// - N7: a held archived choice in a multiple choice field stays, a new pick of it is refused; a
//   misfit field answers 400 before a 409 `possible_duplicate`; the owner's search with archived
//   charts finds an archived chart by a field value.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { testClock } from '../identity/support.ts';
import { activeMember, type Clinic, type TeamWorld, teamWorld } from '../team/support.ts';
import { editField, pathsOf } from './fields-support.ts';
import { archive, chartInput, codeOf, edit, found, register, registered } from './support.ts';
import { chartIn, fieldOf, valueOf } from './values-support.ts';

const clock = testClock();
let world: TeamWorld;
let clinic: Clinic;
let owner: string;
let reception: string;

beforeAll(async () => {
  world = await teamWorld(clock, 2026_12_14);
  clinic = await world.clinic();
  owner = clinic.owner.cookie;
  reception = (await activeMember(world, clinic, [{ role: 'receptionist', branchId: null }]))
    .cookie;
});

afterAll(async () => {
  await world.app.app.close();
});

describe('replays (security M1, N2)', () => {
  it('answers another member 409 for any guess; the registrar replays in any key order', async () => {
    const hidden = await fieldOf(world.app, owner, 'yes_no', {
      viewRoles: ['owner'],
      editRoles: ['owner'],
    });
    const other = await fieldOf(world.app, owner, 'text');
    const input = chartInput(world.phone(), { fields: { [hidden.key]: true, [other.key]: 'أ' } });
    const first = chartIn(await register(world, owner, input), 201);
    for (const fields of [
      { [hidden.key]: true, [other.key]: 'أ' },
      { [hidden.key]: false, [other.key]: 'أ' },
      { [other.key]: 'أ' },
    ]) {
      const guess = await register(world, reception, { ...input, fields });
      expect(guess.statusCode).toBe(409);
      expect(codeOf(guess)).toBe('patient_id_taken');
    }
    const reordered = { ...input, fields: { [other.key]: 'أ', [hidden.key]: true } };
    expect(chartIn(await register(world, owner, reordered), 201).id).toBe(first.id);
  });
});

describe('the largest values (B1, L1)', () => {
  it('stores 250 picked choices and 2,000 characters of 4 bytes', async () => {
    const options = Array.from({ length: 250 }, (_, i) => ({ label: `خيار ${String(i + 1)}` }));
    const many = await fieldOf(world.app, owner, 'multi_choice', { options });
    const long = await fieldOf(world.app, owner, 'long_text');
    const ids = many.options.map((o) => o.id);
    const text = '𝔸'.repeat(2000);
    const chart = chartIn(
      await register(
        world,
        reception,
        chartInput(world.phone(), { fields: { [many.key]: ids, [long.key]: text } }),
      ),
      201,
    );
    expect(valueOf(chart, many.key)).toEqual(ids);
    expect(valueOf(chart, long.key)).toBe(text);
  });
});

describe('review gaps (N7)', () => {
  it('keeps a held archived choice of a multiple choice; a new pick of it is refused', async () => {
    const field = await fieldOf(world.app, owner, 'multi_choice');
    const [held, kept, third] = field.options;
    const chart = chartIn(
      await register(
        world,
        reception,
        chartInput(world.phone(), { fields: { [field.key]: [held?.id, kept?.id] } }),
      ),
      201,
    );
    const res = await editField(world.app, owner, field.key, {
      expectedUpdatedAt: field.updatedAt,
      options: field.options.map((o) => ({
        id: o.id,
        label: o.label,
        archived: o.id === held?.id,
      })),
    });
    expect(res.statusCode, res.body).toBe(200);
    const kept2 = chartIn(
      await edit(world, reception, chart.id, {
        expectedUpdatedAt: chart.updatedAt,
        fields: { [field.key]: [held?.id, third?.id] },
      }),
    );
    expect(valueOf(kept2, field.key)).toEqual([held?.id, third?.id]);
    const fresh = await register(
      world,
      reception,
      chartInput(world.phone(), { fields: { [field.key]: [held?.id] } }),
    );
    expect(pathsOf(fresh)).toEqual([`body.fields.${field.key}`]);
  });

  it('answers a misfit field 400 before a possible duplicate', async () => {
    const number = await fieldOf(world.app, owner, 'number', { validation: { min: 0, max: 9 } });
    const first = await registered(world, reception);
    const twin = chartInput(first.contactPhone, {
      givenName: first.givenName,
      fatherName: first.fatherName,
      familyName: first.familyName,
      fields: { [number.key]: 99 },
    });
    const res = await register(world, reception, twin);
    expect(res.statusCode, res.body).toBe(400);
    expect(pathsOf(res)).toEqual([`body.fields.${number.key}`]);
  });

  it('finds an archived chart by a field value when the owner searches archived charts', async () => {
    const card = await fieldOf(world.app, owner, 'text', { searchable: true });
    const chart = await registered(world, owner, { fields: { [card.key]: 'بطاقة مؤرشفة 5' } });
    chartIn(await archive(world, owner, chart.id, chart.updatedAt));
    const ids = (r: { results: { id: string; matchedBy: string }[] }) =>
      r.results.filter((h) => h.matchedBy === 'custom_field').map((h) => h.id);
    expect(ids(await found(world, owner, 'بطاقة مؤرشفة 5'))).toEqual([]);
    const all = await found(world, owner, 'بطاقة مؤرشفة 5', { includeArchived: true });
    expect(ids(all)).toEqual([chart.id]);
  });
});
