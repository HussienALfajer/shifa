// Opens every state of every board of the screens canvas in Chromium as the canvas does (its own
// document and window, the screens bundle, the sheet, state and theme), waits until the state is
// reached and the fake server is quiet, and reports what went wrong: a step that found nothing, a
// page or console error, content wider than the window. Before that, it fails on a Shifa token the
// bundle reads but never declares (tokens.ts) and on a screen of the code or a server answer its
// sheet leaves out (coverage.ts). Then it opens each board as the canvas does, the app in its own
// window beside the state panel, and works the panel (check-board.ts). Writes each state's height
// to heights.json for canvas.ts, and a screenshot of each state when an output folder is given.
// Clinic web's sheets by default; `--app=admin` checks admin web's ("Shifa Screens · Admin web").
// Usage: node scripts/screens/check.ts <screens-dir with screens.js/.css> <heights.json> [shots-dir] [key-prefix…] [--app=admin]
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { type Browser, chromium, type Page } from 'playwright';
import { boards, heightKey, renders } from './boards.ts';
import { CANVAS_SANDBOX, checkBoard } from './check-board.ts';
import { coverageProblems, unansweredCodes } from './coverage.ts';
import type { Sheet } from './scenario.ts';
import { SHEETS_OF } from './scenarios/index.ts';
import type { ScreensApp } from './state.ts';
import { undeclaredTokens } from './tokens.ts';

const args = process.argv.slice(2);
const app: ScreensApp = args.includes('--app=admin') ? 'admin' : 'clinic';
const sheets = SHEETS_OF[app];
const [dirArg, heightsArg, shotsArg, ...only] = args.filter((a) => !a.startsWith('--app='));
if (!dirArg || !heightsArg) {
  throw new Error(
    'usage: check.ts <screens-dir> <heights.json> [shots-dir] [prefix…] [--app=admin]',
  );
}
const js = readFileSync(join(resolve(dirArg), 'screens.js'), 'utf8');
const css = readFileSync(join(resolve(dirArg), 'screens.css'), 'utf8');
if (shotsArg) mkdirSync(resolve(shotsArg), { recursive: true });

type Mount = [sheet: string, state: string, theme: string];

const STATE_ORIGIN = 'https://state.test';

/** A window with the bundle loaded and its errors collected. */
async function open(browser: Browser, width: number, height: number) {
  const page = await browser.newPage({ viewport: { width, height } });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text().slice(0, 300));
  });
  // Sandboxed as the canvas's frames are (no forms, forms.ts): a press that never reaches the
  // fake server leaves its answer unshown, which the coverage below reports.
  await page.route(`${STATE_ORIGIN}/**`, (route) =>
    route.fulfill({
      contentType: 'text/html',
      headers: { 'content-security-policy': CANVAS_SANDBOX },
      body: `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><style>${css}</style></head><body><div id="board"></div></body></html>`,
    }),
  );
  await page.goto(`${STATE_ORIGIN}/state.html`);
  await page.addScriptTag({ content: js });
  return { page, errors };
}

/** Starts a state in the board (ending the one before, as a change of tweak does). */
async function mount(page: Page, args: Mount): Promise<string> {
  await page.evaluate(([sheet, state, theme]) => {
    const g = globalThis as unknown as {
      ShifaScreens: { mount: (e: HTMLElement, o: object) => () => void };
      endBoard?: () => void;
    };
    g.endBoard?.();
    const host = document.getElementById('board');
    if (host) g.endBoard = g.ShifaScreens.mount(host, { sheet, state, theme });
  }, args);
  return page
    .waitForFunction(
      () =>
        ['ready', 'failed'].includes(
          document.querySelector<HTMLElement>('[data-screen]')?.dataset['screen'] ?? '',
        ),
      null,
      { timeout: 40_000 },
    )
    .then(() =>
      page.evaluate(() => {
        const board = document.querySelector<HTMLElement>('[data-screen]');
        const state = board?.dataset['screen'] ?? '';
        // A state that failed says why (the step that found nothing).
        return state === 'failed' ? `failed: ${board?.dataset['screenError'] ?? ''}` : state;
      }),
    )
    .catch(() => 'timeout');
}

const heights: Record<string, number> = {};
let problems = 0;
const report = (key: string, errors: string[]) => {
  if (errors.length === 0) return;
  problems += 1;
  process.stdout.write(`${key}: ${errors.join(' | ')}\n`);
};
report(
  'tokens',
  undeclaredTokens(css, js).map((t) => `${t} is read but never declared`),
);
if (only.length === 0) report('coverage', coverageProblems(app));
// A height measured before (an earlier run) sizes the boards opened with a prefix.
function measuredBefore(path: string): Record<string, number> {
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as Record<string, number>;
  } catch {
    return {};
  }
}
const before = measuredBefore(resolve(heightsArg));

const browser = await chromium.launch();

const answeredBy = new Map<Sheet, Set<string>>();
const list = renders(sheets).filter(
  (r) => only.length === 0 || only.some((p) => r.key.startsWith(p)),
);
for (const r of list) {
  const { page, errors } = await open(browser, r.width, r.height);
  const done = await mount(page, [r.sheet.id, r.scenario.id, r.theme]);
  await page.waitForTimeout(400);
  const measured = await page.evaluate(() => ({
    height: document.documentElement.scrollHeight,
    width: document.documentElement.scrollWidth,
  }));
  const codes = await page.evaluate(() =>
    (
      globalThis as unknown as { ShifaScreens: { answered: () => string[] } }
    ).ShifaScreens.answered(),
  );
  const seen = answeredBy.get(r.sheet) ?? new Set<string>();
  for (const c of codes) seen.add(c);
  answeredBy.set(r.sheet, seen);
  const key = heightKey(r.sheet, r.scenario, r.device);
  heights[key] = Math.max(heights[key] ?? 0, measured.height);
  if (measured.width > r.width) {
    const known = r.device === 'phone' ? r.scenario.widerOnPhone : undefined;
    if (known)
      process.stdout.write(`${r.key}: known, ${String(measured.width)}px: ${known}
`);
    else errors.push(`wider than the window: ${String(measured.width)}px`);
  }
  if (done !== 'ready') errors.push(`state not reached: ${done}`);
  if (shotsArg) {
    await page.screenshot({
      path: join(resolve(shotsArg), `${r.key}.png`),
      fullPage: r.scenario.overlay !== true,
    });
  }
  report(r.key, errors);
  await page.close();
}

// Every error code a sheet's code handles is answered in one of its states (all states run only).
if (only.length === 0) {
  for (const [sheet, seen] of answeredBy) {
    report(
      `${sheet.id} answers`,
      unansweredCodes(sheet, seen).map(
        (c) => `«${c}» is handled by its code but shown by no state`,
      ),
    );
  }
}

// Each board as the canvas shows it: the app's window beside the state panel, the panel worked.
for (const b of boards(sheets).filter(
  (x) => only.length === 0 || only.some((p) => x.file.startsWith(p)),
)) {
  const tallest = Math.max(
    b.height,
    ...b.states.map((s) =>
      s.overlay === true ? b.height : (heights[heightKey(b.sheet, s, b.device)] ?? b.height),
    ),
  );
  const shot = shotsArg
    ? join(resolve(shotsArg), `${b.file.replace('.dc.html', '')}Board.png`)
    : undefined;
  report(b.file, await checkBoard(browser, b, tallest, { js, css }, shot));
}

await browser.close();
writeFileSync(resolve(heightsArg), `${JSON.stringify({ ...before, ...heights }, null, 1)}\n`);
process.stdout.write(`${String(list.length)} states, ${String(problems)} with problems\n`);
if (problems > 0) process.exitCode = 1;
