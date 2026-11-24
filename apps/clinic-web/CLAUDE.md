# @shifa/clinic-web

The clinic web system. Since A-01-06 a signed-out-safe shell: everything lives in `@shifa/web-shell` (routes, guard, session, placeholder pages); `src/main.tsx` mounts it with `app: 'clinic'`. Screens arrive with A-01-07, drawn and approved first (ADR-0040, ADR-0042).

- `pnpm --filter @shifa/clinic-web dev` on 5173 (setup links point here, `CLINIC_WEB_URL`); `/api` goes to `SHIFA_API_URL` (default `http://127.0.0.1:3000`).
- `test/production-build.test.ts` builds for production and refuses UI SDK's development history.
- Use `Button` from `@shifa/ui`, never `<button>` (lint `shifa/no-raw-button`).
