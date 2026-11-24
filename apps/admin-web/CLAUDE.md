# @shifa/admin-web

The super admin web app. Everything lives in `@shifa/web-shell`; `src/main.tsx` mounts it with `app: 'admin'`, so a session without `platformAdmin` is signed out (`reason=not_admin`). Since A-01-10 checkpoint 3 its home is the clinics list, with «إنشاء عيادة» and each clinic's page (`packages/web-shell/src/admin/`), drawn and approved first (ADR-0040, ADR-0042).

- `pnpm --filter @shifa/admin-web dev` on 5174; `/api` goes to `SHIFA_API_URL` (default `http://127.0.0.1:3000`).
- `test/production-build.test.ts` builds for production and refuses UI SDK's development history.
- Use `Button` from `@shifa/ui`, never `<button>` (lint `shifa/no-raw-button`).
