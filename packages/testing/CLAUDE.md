# @shifa/testing

Test helpers shared by every package: `Clock`/`FixedClock` and the synthetic data generator (spec `docs/specs/foundation/0.2-08-synthetic-data-generator.md`). Fixtures, seeds, snapshots and screenshots take their people, phones and money from here and nowhere else (`docs/compliance/data-handling.md` §1).

## Synthetic data rules (`src/synthetic/`)
- Synthetic only. Never add a real person, clinic, doctor, patient or phone number, not even "as an example". Name lists hold common given and family names; a generated name is only a combination of list entries.
- Pure and deterministic: no `Math.random`, `Date.now`, `new Date()` without an argument, `process`, `globalThis`, `fetch`, `crypto` or `node:` imports. `test/synthetic/purity.test.ts` scans for them. Dates come from a `Clock` argument.
- All randomness goes through `createRandom(seed)`. When you add a new field or record type, draw it from its own `random.fork('<label>')` so existing values for the same seed do not shift. The same label on the same parent returns the same stream, so labels must be unique per parent: in loops fork by index (`fork(String(index))`) first.
- Use `IdRegistry` for ids and `PhoneRegistry` for account phones, so a dataset never repeats either by chance.
- Changing the PRNG, the seed hashing or the order of draws changes every dataset; that needs a note in the PR and an updated golden hash (0.2-08b).
- Money is `{ amountMinor: bigint, currency }` on whole cash units (BIL-01, BIL-04), SYP on new-pound scale (BIL-05). Never a `number` amount.
- Phones: E.164 on a listed operator prefix with the `00` marker after it, so `isSyntheticPhone` stays true for every generated number. When adding a prefix, add its source in the table. The marker does not make a number safe to message: non-production sends go only to an allowlist (MSG-32).
- Name lists are data reviewed by the owner: keep entries unique, Arabic letters and single spaces only, male and female lists disjoint, Turkmen names apart from the general family list.

## Commands
- `pnpm --filter @shifa/testing test` — unit tests; `pnpm verify` from the root for the full gate.
