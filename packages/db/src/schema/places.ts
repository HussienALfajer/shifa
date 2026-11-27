// Cities and areas (A-02 criterion 15, OD-113, PLT-15; slice A-02-06). Platform tables, global (no
// clinic data): Arabic names the super admin adds, renames, archives and restores; never deleted
// (no role holds DELETE), so ids stay on the branches that hold them. `name_key` is the name as the
// API folds it (`placeKey()` in @shifa/contracts: alef forms, final ة and ى, harakat, spaces), unique
// among cities and among one city's areas, archived ones included. Every role reads both tables;
// shifa_platform writes them only in its place actions (policies and a trigger in the migration).
// The first list (Aleppo and its neighbourhoods, Azaz) is seeded by the migration.
import { sql } from 'drizzle-orm';
import { check, pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core';
import { createdAt, updatedAt } from './columns.ts';

const nameChecks = (table: string, name: unknown, key: unknown) => [
  check(`${table}_name_check`, sql`char_length(btrim(${name})) between 1 and 100`),
  check(`${table}_name_key_check`, sql`char_length(${key}) between 1 and 100`),
];

export const city = pgTable(
  'city',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    nameKey: text('name_key').notNull(),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [unique('city_name_key_key').on(t.nameKey), ...nameChecks('city', t.name, t.nameKey)],
);

export const area = pgTable(
  'area',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    cityId: uuid('city_id')
      .notNull()
      .references(() => city.id),
    name: text('name').notNull(),
    nameKey: text('name_key').notNull(),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    unique('area_city_id_name_key_key').on(t.cityId, t.nameKey),
    // Target of branch_area_fk: a branch's area belongs to the branch's city.
    unique('area_id_city_id_key').on(t.id, t.cityId),
    ...nameChecks('area', t.name, t.nameKey),
  ],
);
