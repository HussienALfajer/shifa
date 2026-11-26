// What the check holds the sheets to, besides each state being reached:
// - every drawn file of clinic web (a `.tsx` of packages/web-shell/src outside admin web and the
//   app's plumbing) belongs to a clinic sheet, and every file of admin web (`admin/*.tsx` and the
//   shared screens it shows) to an admin sheet, so a new screen, dialog or card cannot go unseen;
// - every error code a sheet's code handles is answered by the fake server in one of the sheet's
//   states (the codes each state was answered are recorded by server.ts while the check runs), or
//   the sheet says why it cannot be shown (`unshown`).
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { ErrorCode } from '@shifa/contracts';
import type { Sheet } from './scenario.ts';
import { SHEETS_OF } from './scenarios/index.ts';
import type { ScreensApp } from './state.ts';

const SRC = join(import.meta.dirname, '..', '..', 'src');
/** Not screens: admin web, the build, and the app's plumbing (providers, router, mount). */
const NOT_DRAWN = [/^admin\//, /^vite\//, /^(index|mount|providers|router)\.tsx?$/];

function files(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? files(join(dir, e.name)) : [relative(SRC, join(dir, e.name))],
  );
}

/**
 * The shell's screens admin web shows besides its own (`admin/`): sign-in, the setup link of a
 * super admin, the second factor, the idle warning, the remaining pages, the failed read.
 */
const ADMIN_SHARED = [
  'auth/sign-in.tsx',
  'auth/sign-in-notice.tsx',
  'auth/auth-layout.tsx',
  'auth/setup-link.tsx',
  'auth/mfa.tsx',
  'auth/mfa-challenge.tsx',
  'auth/mfa-enrol.tsx',
  'auth/recovery-codes.tsx',
  'auth/lock-callout.tsx',
  'account/load-failed.tsx',
  'idle-dialog.tsx',
  'pages.tsx',
];

/** The drawn files of an app that no sheet of it lists. */
export function unlistedScreens(app: ScreensApp = 'clinic', sheets = SHEETS_OF[app]): string[] {
  const listed = new Set(sheets.flatMap((s) => s.code));
  const drawn = (f: string) =>
    app === 'admin'
      ? /^admin\/.*\.tsx$/.test(f) || ADMIN_SHARED.includes(f)
      : f.endsWith('.tsx') && !NOT_DRAWN.some((re) => re.test(f));
  return files(SRC)
    .map((f) => f.replaceAll('\\', '/'))
    .filter((f) => drawn(f) && !listed.has(f))
    .sort();
}

const CODES = new Set<string>(ErrorCode.options);

/** The API error codes a sheet's code names (as string literals). */
export function handledCodes(sheet: Sheet): Set<string> {
  const found = new Set<string>();
  for (const file of sheet.code) {
    const text = readFileSync(join(SRC, file), 'utf8');
    for (const m of text.matchAll(/['"`]([a-z_]+)['"`]/g)) {
      if (m[1] && CODES.has(m[1])) found.add(m[1]);
    }
  }
  return found;
}

/** The codes a sheet's code handles that none of its states shows, nor `unshown` explains. */
export function unansweredCodes(sheet: Sheet, answered: Set<string>): string[] {
  return [...handledCodes(sheet)]
    .filter((code) => !answered.has(code) && !(code in (sheet.unshown ?? {})))
    .sort();
}

/** The static part, run before any browser opens. */
export function coverageProblems(app: ScreensApp = 'clinic'): string[] {
  return unlistedScreens(app).map((f) => `src/${f} is on no sheet`);
}
