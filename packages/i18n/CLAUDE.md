# @shifa/i18n

The one translation source for the web apps (i18next with ICU) and the Flutter patient app (ARB generated from it). Arabic (`ar`) is the base locale and the only one in Release 1; Turkish is OD-16.

## Layout
- `src/locales/<locale>/<namespace>.json` — flat `key → ICU message`. Namespaces: `common` (shared UI words), `errors` (one key per `ErrorCode` of `@shifa/contracts`). A new feature area may add a namespace.
- `src/checks.ts` — ICU syntax, plural categories, error-code coverage, locale parity, values; run by `test/` (so by `verify` and CI) against the real source.
- `scripts/generate.ts` → `generated/keys.ts` (key union per namespace) and `generated/arb/app_ar.arb` (Flutter `gen-l10n` input, names `<namespace><Key>`). Never edit `generated/`; after any source change run `node scripts/check-drift.mjs --fix` and commit it (the `i18n` drift check fails otherwise).

## Rules
- Never hard-code user-facing text in an app: add a key here and use it. Synthetic copy only; the owner reviews Arabic wording in the PR.
- Keys are identifiers (`^[a-z][a-zA-Z0-9_]*$`): camelCase in `common`, the exact `ErrorCode` in `errors`. Never rename a key a client uses; add one.
- Messages are ICU MessageFormat. Plurals list every CLDR category of the locale (Arabic: `zero one two few many other`); exact matches (`=0`) do not replace them. Write `{count}` in plural branches, never `#` (gen-l10n does not support it).
- Only what both consumers render alike: named arguments (`^[a-z][a-zA-Z0-9]*$`), cardinal `plural` (options: the categories plus `=0 =1 =2`) and `select`. No `number`/`date`/`time` arguments or `selectordinal` (the app formats values), no ASCII `'` (ICU quoting differs; write `’`). Tags are plain text (`ignoreTag`); the web's i18next-icu setup must parse the same way.
- Namespaces are lower camelCase file names; locale folders are canonical BCP 47 tags.
- No digits, dates or numbers baked into text: pass them as arguments; digit style is OD-20 and decided at render time.
- Every `ar` value contains an Arabic letter; a Latin-only value (brand name) goes on `LATIN_ALLOWED` in `src/checks.ts`.
- An `ErrorCode` added in `@shifa/contracts` needs its `errors.<code>` message in the same PR (the test fails otherwise).
