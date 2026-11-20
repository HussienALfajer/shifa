---
paths:
  - "packages/ui/**"
---

# Web components (packages/ui)

- Build or change a component with the `/ui-component` skill; the package's `CLAUDE.md` holds the styling and test rules.
- No component code without a sheet the owner approved (ADR-0040); the look is the sheet's, the behaviour is proven by tests.
- The public API never names `@ui-sdk/*` or Base UI (`test/public-api.test.ts`). `@ui-sdk/react/agent` is never imported.
- Western digits shown, Arabic-Indic accepted (`useWesternDigits`, OD-20); dates and numbers in `ar-SY-u-nu-latn`, the week from Saturday (OD-61).
- Arabic letters in a test: `pressKeys` outside a text field, `typeArabic` inside one.
- Names in tests and stories come from `test/fixtures.ts` (the synthetic generator), never typed in.
- A UI SDK upgrade is its own PR (design doc, "UI SDK upgrade rule").
