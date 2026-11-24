# @shifa/admin-web

The super admin web app. Since A-01-06 a signed-out-safe shell: everything lives in `@shifa/web-shell`; `src/main.tsx` mounts it with `app: 'admin'`, so a session without `platformAdmin` is signed out (`reason=not_admin`). Screens arrive with A-01-08, drawn and approved first (ADR-0040, ADR-0042).

- `pnpm --filter @shifa/admin-web dev` on 5174; `/api` goes to `SHIFA_API_URL` (default `http://127.0.0.1:3000`).
- `test/production-build.test.ts` builds for production and refuses UI SDK's development history.
- Use `Button` from `@shifa/ui`, never `<button>` (lint `shifa/no-raw-button`).
