// The check of each board as the canvas shows it (panel.tsx): the app in its own window of the
// device's width beside the state panel. Opens the board from a served copy of the bundle (the
// inner window loads the script by address and takes the inlined stylesheet, as on the canvas), then works the panel as a viewer does:
// the theme switch, a state chosen in the list, «Reset» back to the Tweaks values. Each must
// restart the app at that state, and the app's window must keep the device's width.
import type { Browser, Frame, Page } from 'playwright';
import { type Board, boardWidth } from './boards.ts';

const ORIGIN = 'https://screens.test';

/** The start of the app now in the window (0 before the first). */
const runOf = (frame: Frame) =>
  frame.evaluate(() =>
    Number(document.querySelector<HTMLElement>('[data-screen]')?.dataset['run'] ?? 0),
  );

/**
 * Waits for a start of the app after `after` to reach its state (never the one before a press,
 * still on screen for a moment); returns how it ended.
 */
async function reached(frame: Frame, after = 0): Promise<string> {
  return frame
    .waitForFunction(
      (since) => {
        const board = document.querySelector<HTMLElement>('[data-screen]');
        return (
          Number(board?.dataset['run'] ?? 0) > since &&
          ['ready', 'failed'].includes(board?.dataset['screen'] ?? '')
        );
      },
      after,
      { timeout: 40_000 },
    )
    .then(() =>
      frame.evaluate(() => {
        const board = document.querySelector<HTMLElement>('[data-screen]');
        const state = board?.dataset['screen'] ?? '';
        return state === 'failed' ? `failed: ${board?.dataset['screenError'] ?? ''}` : state;
      }),
    )
    .catch(() => 'timeout');
}

async function appFrame(page: Page): Promise<Frame> {
  const handle = await page.waitForSelector('[data-board] iframe');
  const frame = await handle.contentFrame();
  if (!frame) throw new Error('no app window');
  return frame;
}

/** The state and the theme the app inside shows. */
const stateOf = (frame: Frame) =>
  frame.evaluate(
    () => document.querySelector<HTMLElement>('[data-screen]')?.dataset['state'] ?? '',
  );
const themeOf = (frame: Frame) =>
  frame.evaluate(() => document.querySelector('[data-theme]')?.getAttribute('data-theme') ?? '');

export async function checkBoard(
  browser: Browser,
  b: Board,
  height: number,
  files: { js: string; css: string },
  /** A screenshot of the board at its last state, dark, when given. */
  shot?: string,
): Promise<string[]> {
  const width = boardWidth(b.device);
  const page = await browser.newPage({ viewport: { width, height } });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text().slice(0, 300));
  });
  await page.route(`${ORIGIN}/**`, async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/screens/screens.js') {
      await route.fulfill({ body: files.js, contentType: 'text/javascript' });
    } else if (path === '/board.html') {
      // The stylesheet inlined, as the live canvas serves it: no `screens.css` to load by address,
      // so the inner window must take its styles from this document.
      await route.fulfill({
        contentType: 'text/html',
        body: `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><style>${files.css}</style><script src="screens/screens.js"></script><style>html,body{margin:0}</style></head><body><div id="host"></div></body></html>`,
      });
    } else {
      await route.fulfill({ status: 404, body: '' });
    }
  });
  await page.goto(`${ORIGIN}/board.html`);
  const first = b.states[0];
  const last = b.states.at(-1);
  if (!first || !last) return ['no states'];
  await page.evaluate(
    ([sheet, w, h, state]) => {
      const g = globalThis as unknown as {
        ShifaScreens: { mountBoard: (e: HTMLElement, p: object) => unknown };
      };
      const host = document.getElementById('host');
      if (host)
        g.ShifaScreens.mountBoard(host, { sheet, width: w, height: h, state, theme: 'light' });
    },
    [b.sheet.id, b.width, height, first.id] as const,
  );
  let frame = await appFrame(page);
  let done = await reached(frame);
  if (done !== 'ready') errors.push(`board: first state not reached: ${done}`);
  const styled = await frame.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue('--shifa-screens-bundle').trim(),
  );
  if (styled !== '1') errors.push("board: the app's window has no stylesheet");
  const inner = await frame.evaluate(() => window.innerWidth);
  if (inner !== b.width)
    errors.push(`board: the app's window is ${String(inner)}px, not ${String(b.width)}`);
  const outer = await page.evaluate(() => document.documentElement.scrollWidth);
  if (outer > width) errors.push(`board: wider than ${String(width)}px (${String(outer)})`);

  // The theme switch restarts the app dark.
  let run = await runOf(frame);
  await page.getByRole('radio', { name: 'Dark' }).click();
  frame = await appFrame(page);
  done = await reached(frame, run);
  if (done !== 'ready') errors.push(`board: dark not reached: ${done}`);
  if ((await themeOf(frame)) !== 'dark')
    errors.push('board: the theme switch did not reach the app');

  // A state chosen in the panel's list.
  if (last !== first) {
    run = await runOf(frame);
    await page.getByRole('radio', { name: last.title, exact: true }).click();
    done = await reached(frame, run);
    if (done !== 'ready') errors.push(`board: the panel's state not reached: ${done}`);
    if ((await stateOf(frame)) !== last.id) errors.push('board: the list did not restart the app');
  }
  if (shot) await page.screenshot({ path: shot });

  // «Reset» goes back to the Tweaks values (the first state, light).
  run = await runOf(frame);
  await page.getByRole('button', { name: 'Reset' }).click();
  done = await reached(frame, run);
  if (done !== 'ready') errors.push(`board: Reset not reached: ${done}`);
  if ((await themeOf(frame)) !== 'light') errors.push('board: Reset kept the dark theme');
  if ((await stateOf(frame)) !== first.id) errors.push('board: Reset kept the chosen state');
  const apps = await frame.evaluate(() => document.querySelectorAll('[data-screen]').length);
  if (apps !== 1) errors.push(`board: ${String(apps)} apps in the window after Reset`);
  await page.close();
  return errors;
}
