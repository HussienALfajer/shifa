// Column helpers shared by the schema files.
import { timestamp } from 'drizzle-orm/pg-core';

export const createdAt = () =>
  timestamp('created_at', { withTimezone: true }).notNull().defaultNow();
export const updatedAt = () =>
  timestamp('updated_at', { withTimezone: true }).notNull().defaultNow();

/** E.164: a plus, a non-zero digit, 7 to 14 more digits (normalised by the API, A-01a 6). */
export const E164_CHECK = `'^\\+[1-9][0-9]{7,14}$'`;
/** SHA-256 as 64 lower-case hex digits (setup-link tokens, throttle keys). */
export const SHA256_HEX_CHECK = `'^[0-9a-f]{64}$'`;
