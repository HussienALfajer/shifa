// A-03 criteria 17, 40 (A-03-06). Contract row "List (owner's fields)": `chartCount` per field and
// per choice (improvement 8), and the purge of an archived field's values.
// - `chartCount`: charts holding a value of the field (or the choice), active and archived, not
//   merged; a cleared value stops counting.
// - A field restored within 30 days shows its values again; on day 31 a chart write purges the
//   field and deletes its values (fake clock).
import { patient } from '@shifa/db';
import { superuserDb, workerDatabaseName } from '@shifa/db/testing';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { testClock } from '../identity/support.ts';
import { type Clinic, type TeamWorld, teamWorld } from '../team/support.ts';
import { archiveField, DAY_MS, definitions, ownerAgain, restoreField } from './fields-support.ts';
import { archive, chartOf, edit, registered } from './support.ts';
import { chartIn, fieldOf, storedValues, valueOf } from './values-support.ts';

const clock = testClock();
let world: TeamWorld;
let clinic: Clinic;
let owner: string;

beforeAll(async () => {
  world = await teamWorld(clock, 2026_12_12);
  clinic = await world.clinic();
  owner = clinic.owner.cookie;
});

afterAll(async () => {
  await world.app.app.close();
});

describe('chart counts (criterion 40)', () => {
  it('counts charts per field and per choice, live charts only', async () => {
    const text = await fieldOf(world.app, owner, 'text');
    const multi = await fieldOf(world.app, owner, 'multi_choice');
    const [a, b, c] = multi.options.map((o) => o.id);
    const one = await registered(world, owner, {
      fields: { [text.key]: 'x', [multi.key]: [a, b] },
    });
    const two = await registered(world, owner, { fields: { [text.key]: 'y', [multi.key]: [a] } });
    const three = await registered(world, owner, { fields: { [multi.key]: [c] } });
    const counts = async () => {
      const list = await definitions(world.app, owner);
      const of = (key: string) =>
        list.fields.find((f) => f.key === key) as unknown as {
          chartCount: number;
          options: { id: string; chartCount: number }[];
        };
      const m = of(multi.key);
      return {
        text: of(text.key).chartCount,
        multi: m.chartCount,
        options: m.options.map((o) => o.chartCount),
      };
    };
    expect(await counts()).toEqual({ text: 2, multi: 3, options: [2, 1, 1] });

    await edit(world, owner, two.id, {
      expectedUpdatedAt: two.updatedAt,
      fields: { [text.key]: null },
    });
    expect((await counts()).text).toBe(1);
    chartIn(await archive(world, owner, three.id, three.updatedAt));
    expect(await counts()).toEqual({ text: 1, multi: 3, options: [2, 1, 1] });
    await superuserDb(workerDatabaseName())
      .update(patient)
      .set({ state: 'merged', mergedIntoId: two.id })
      .where(eq(patient.id, one.id));
    expect(await counts()).toEqual({ text: 0, multi: 2, options: [1, 0, 1] });
  });
});

describe('the purge of values (criterion 17)', () => {
  it('a restored field shows its values again; on day 31 a chart write deletes them', async () => {
    const field = await fieldOf(world.app, owner, 'text');
    const chart = await registered(world, owner, { fields: { [field.key]: 'باقية' } });
    expect((await archiveField(world.app, owner, field.key)).statusCode).toBe(200);
    expect(valueOf(chartIn(await chartOf(world, owner, chart.id)), field.key)).toBeUndefined();
    expect((await restoreField(world.app, owner, field.key)).statusCode).toBe(200);
    expect(valueOf(chartIn(await chartOf(world, owner, chart.id)), field.key)).toBe('باقية');

    expect((await archiveField(world.app, owner, field.key)).statusCode).toBe(200);
    clock.advanceBy(31 * DAY_MS);
    const cookie = await ownerAgain(world, clinic);
    expect(await storedValues(chart.id)).toHaveLength(1);
    const read = chartIn(await chartOf(world, cookie, chart.id));
    expect(valueOf(read, field.key)).toBeUndefined();
    await registered(world, cookie);
    expect(await storedValues(chart.id)).toHaveLength(0);
    const list = await definitions(world.app, cookie);
    expect(list.fields.map((f) => f.key)).not.toContain(field.key);
  });
});
