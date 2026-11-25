// Opens every state of every board of the screens canvas in Chromium as the canvas does (its own
// document and window, the screens bundle, the sheet, state and theme), waits until the state is
// reached and the fake server is quiet, and reports what went wrong: a step that found nothing, a
// page or console error, content wider than the window. Then, on each board, switches from its
// first state to its last as the Tweaks panel does. Writes each state's height to heights.json
// for canvas.ts, and a screenshot of each state when an output folder is given.
// Usage: node scripts/screens/check.ts <screens-dir with screens.js/.css> <heights.json> [shots-dir] [key-prefix…]
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { type Browser, chromium, type Page } from 'playwright';
import { boards, heightKey, renders } from './boards.ts';

const [dirArg, heightsArg, shotsArg, ...only] = process.argv.slice(2);
if (!dirArg || !heightsArg) {
  throw new Error('usage: check.ts <screens-dir> <heights.json> [shots-dir] [prefix…]');
}
const js = readFileSync(join(resolve(dirArg), 'screens.js'), 'utf8');
const css = readFileSync(join(resolve(dirArg), 'screens.css'), 'utf8');
if (shotsArg) mkdirSync(resolve(shotsArg), { recursive: true });

type Mount = [sheet: string, state: string, theme: string];

/** A window with the bundle loaded and its errors collected. */
async function open(browser: Browser, width: number, height: number) {
  const page = await browser.newPage({ viewport: { width, height } });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text().slice(0, 300));
  });
  await page.setContent(
    `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><style>${css}</style></head><body><div id="board"></div></body></html>`,
  );
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

const browser = await chromium.launch();
const heights: Record<string, number> = {};
let problems = 0;
const report = (key: string, errors: string[]) => {
  if (errors.length === 0) return;
  problems += 1;
  process.stdout.write(`${key}: ${errors.join(' | ')}\n`);
};

const list = renders().filter((r) => only.length === 0 || only.some((p) => r.key.startsWith(p)));
for (const r of list) {
  const { page, errors } = await open(browser, r.width, r.height);
  const done = await mount(page, [r.sheet.id, r.scenario.id, r.theme]);
  await page.waitForTimeout(400);
  const measured = await page.evaluate(() => ({
    height: document.documentElement.scrollHeight,
    width: document.documentElement.scrollWidth,
  }));
  const key = heightKey(r.sheet, r.scenario, r.device);
  heights[key] = Math.max(heights[key] ?? 0, measured.height);
  if (measured.width > r.width) errors.push(`wider than the window: ${String(measured.width)}px`);
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

// A change of tweak: the board's first state, then its last, in the same window.
for (const b of boards().filter(
  (x) => only.length === 0 || only.some((p) => x.file.startsWith(p)),
)) {
  const first = b.states[0];
  const last = b.states.at(-1);
  if (!first || !last || first === last) continue;
  const { page, errors } = await open(browser, b.width, b.height);
  await mount(page, [b.sheet.id, first.id, 'light']);
  const done = await mount(page, [b.sheet.id, last.id, 'dark']);
  if (done !== 'ready') errors.push(`switch not reached: ${done}`);
  const boards = await page.evaluate(() => document.querySelectorAll('[data-screen]').length);
  if (boards !== 1) errors.push(`switch left ${String(boards)} apps on the board`);
  report(`${b.file} switch`, errors);
  await page.close();
}

await browser.close();
writeFileSync(resolve(heightsArg), `${JSON.stringify(heights, null, 1)}\n`);
process.stdout.write(`${String(list.length)} states, ${String(problems)} with problems\n`);
if (problems > 0) process.exitCode = 1;
