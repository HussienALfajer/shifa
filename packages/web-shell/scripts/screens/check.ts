// Opens every board of the screens canvas in Chromium as the canvas does (its own document and
// window, the screens bundle, the board's sheet, state and theme), waits until the state is
// reached and the fake server is quiet, and reports what went wrong: a step that found nothing,
// a page error, a console error, content wider than the window. Writes each board's height to
// heights.json for canvas.ts, and a screenshot of each when an output folder is given.
// Usage: node scripts/screens/check.ts <screens-dir with screens.js/.css> <heights.json> [shots-dir] [name-prefix…]
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright';
import { boards } from './boards.ts';

const [dirArg, heightsArg, shotsArg, ...only] = process.argv.slice(2);
if (!dirArg || !heightsArg)
  throw new Error('usage: check.ts <screens-dir> <heights.json> [shots-dir] [prefix…]');
const js = readFileSync(join(resolve(dirArg), 'screens.js'), 'utf8');
const css = readFileSync(join(resolve(dirArg), 'screens.css'), 'utf8');
if (shotsArg) mkdirSync(resolve(shotsArg), { recursive: true });

const browser = await chromium.launch();
const heights: Record<string, number> = {};
let problems = 0;
const list = boards().filter((b) => only.length === 0 || only.some((p) => b.file.startsWith(p)));
for (const b of list) {
  const page = await browser.newPage({ viewport: { width: b.width, height: b.height } });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text().slice(0, 300));
  });
  await page.setContent(
    `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><style>${css}</style></head><body><div id="board"></div></body></html>`,
  );
  await page.addScriptTag({ content: js });
  await page.evaluate(
    ([sheet, state, theme]) => {
      const host = document.getElementById('board') as HTMLElement;
      (
        globalThis as unknown as { ShifaScreens: { mount: (e: HTMLElement, o: object) => void } }
      ).ShifaScreens.mount(host, { sheet, state, theme });
    },
    [b.sheet.id, b.scenario.id, b.theme],
  );
  const done = await page
    .waitForFunction(
      () => ['ready', 'failed'].includes(document.getElementById('board')?.dataset['screen'] ?? ''),
      null,
      {
        timeout: 40_000,
      },
    )
    .then(() => page.evaluate(() => document.getElementById('board')?.dataset['screen']))
    .catch(() => 'timeout');
  await page.waitForTimeout(400);
  const measured = await page.evaluate(() => ({
    height: document.documentElement.scrollHeight,
    width: document.documentElement.scrollWidth,
  }));
  heights[b.file] = measured.height;
  if (measured.width > b.width) errors.push(`wider than the window: ${String(measured.width)}px`);
  if (done !== 'ready') errors.push(`state not reached: ${String(done)}`);
  if (shotsArg) {
    await page.screenshot({
      path: join(resolve(shotsArg), b.file.replace('.dc.html', '.png')),
      fullPage: b.scenario.overlay !== true,
    });
  }
  if (errors.length > 0) {
    problems += 1;
    console.log(`${b.file}: ${errors.join(' | ')}`);
  }
  await page.close();
}
await browser.close();
writeFileSync(resolve(heightsArg), `${JSON.stringify(heights, null, 1)}\n`);
console.log(`${String(list.length)} boards, ${String(problems)} with problems`);
if (problems > 0) process.exitCode = 1;
