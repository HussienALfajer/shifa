// Opens every board of the "Shifa Components" canvas in Chromium as the canvas does, for every
// combination its Tweaks reach: each view, theme, density and direction (the playground at its
// defaults), and once more with the playground's props changed. The board's logic class runs with
// those props; `<sc-if>` branches and `{{ }}` holes are resolved; each x-import becomes the
// bundle's component in a display:contents span. Reports a missing component or value, an error,
// content wider than its panel and content taller than its board. With --measure it writes each
// board's natural height (its tallest combination) to heights.json for canvas.ts. Usage:
// node scripts/design-system/canvas/check.ts <project-dir> <heights.json> [--measure] [name-prefix…]
import { createReadStream, existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, resolve } from 'node:path';
import { chromium } from 'playwright';
import { undefinedTokens } from '../token-gaps.ts';
import { combinations, type Tweaks } from './combinations.ts';
import { renderBoard } from './render-board.ts';

const [projectArg, heightsArg, ...flags] = process.argv.slice(2);
if (!projectArg || !heightsArg) {
  throw new Error('usage: check.ts <project-dir> <heights.json> [--measure] [prefix…]');
}
const project = resolve(projectArg);
const measure = flags.includes('--measure');
const only = flags.filter((f) => !f.startsWith('--'));
const TYPES: Record<string, string> = {
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.ttf': 'font/ttf',
  '.html': 'text/html',
};

const server = createServer((req, res) => {
  const file = join(project, decodeURIComponent((req.url ?? '/').split('?')[0] ?? '/'));
  if (!file.startsWith(project) || !existsSync(file)) {
    res.writeHead(404).end();
    return;
  }
  res.writeHead(200, { 'content-type': `${TYPES[extname(file)] ?? 'text/plain'}; charset=utf-8` });
  createReadStream(file).pipe(res);
});
await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
const address = server.address();
const base = `http://127.0.0.1:${String(typeof address === 'object' && address ? address.port : 0)}/`;

const heights: Record<string, number> = {};
let problems = 0;
// A token the stylesheet reads and nothing declares resolves to nothing on the canvas (a still
// Spinner, text at the size around it): the system's copy must declare all of them.
const systemCss = (file: string) => readFileSync(join(project, 'ds', 'shifa', file), 'utf8');
const gaps = undefinedTokens(systemCss('components/bundle.css'), systemCss('tokens.css'));
if (gaps.length > 0) {
  problems += 1;
  process.stdout.write(`ds/shifa: tokens read but never declared: ${gaps.join(', ')}\n`);
}

const browser = await chromium.launch();
let runs = 0;
const files = readdirSync(project).filter(
  (f) => f.endsWith('.dc.html') && (only.length === 0 || only.some((o) => f.startsWith(o))),
);
for (const f of files) {
  const html = readFileSync(join(project, f), 'utf8');
  const helmet = /<helmet>([\s\S]*?)<\/helmet>/.exec(html)?.[1] ?? '';
  const body = (/<x-dc>([\s\S]*)<\/x-dc>/.exec(html)?.[1] ?? '').replace(
    /<helmet>[\s\S]*?<\/helmet>/,
    '',
  );
  const script = /<script type="text\/x-dc"[^>]*>([\s\S]*?)<\/script>/.exec(html)?.[1] ?? '';
  const attr = /data-props='([^']*)'/.exec(html)?.[1] ?? '{}';
  const declared = JSON.parse(attr.replaceAll('&#39;', "'").replaceAll('&amp;', '&')) as Tweaks & {
    $preview: { width: number; height: number };
  };
  const { $preview: preview, ...tweaks } = declared;
  const key = f.replace('.dc.html', '');
  for (const combo of combinations(tweaks)) {
    runs += 1;
    const page = await browser.newPage({
      viewport: { width: preview.width, height: preview.height },
    });
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => {
      if (m.type() === 'error' || m.type() === 'warning') {
        errors.push(`${m.type()}: ${m.text().slice(0, 200)}`);
      }
    });
    await page.goto(`${base}ds/shifa/tokens.css`);
    await page.setContent(
      `<!doctype html><html lang="en"><head><meta charset="utf-8"><base href="${base}"><link rel="stylesheet" href="ds/shifa/tokens.css"><link rel="stylesheet" href="ds/shifa/components/bundle.css"><link rel="stylesheet" href="support/states.css"><script src="ds/shifa/components/bundle.js"></script>${helmet}</head><body><template id="t">${body}</template><div id="root"></div></body></html>`,
    );
    await page.waitForLoadState('load');
    await page.evaluate(async () => {
      await Promise.all([...document.fonts].map((x) => x.load()));
    });
    const result = await page.evaluate(renderBoard, {
      src: script,
      props: combo.props,
      measureHeight: measure,
    });
    if (combo.sheet && result.natural !== null)
      heights[key] = Math.max(heights[key] ?? 0, result.natural);
    const taller = !measure && result.content > result.frame + 1;
    const found = [
      ...result.missing.map((m) => `missing ${m}`),
      ...result.over.map((o) => `over ${o}`),
      ...errors,
      ...(taller
        ? [`taller than its board (${String(result.content)} > ${String(result.frame)})`]
        : []),
    ];
    if (found.length > 0) {
      problems += 1;
      process.stdout.write(`${key} [${combo.name}]: ${found.join(' | ')}\n`);
    }
    await page.close();
  }
}
await browser.close();
server.close();
if (measure) {
  const file = resolve(heightsArg);
  const before = existsSync(file)
    ? (JSON.parse(readFileSync(file, 'utf8')) as Record<string, number>)
    : {};
  writeFileSync(file, `${JSON.stringify({ ...before, ...heights }, null, 1)}\n`);
}
process.stdout.write(
  `${String(files.length)} boards, ${String(runs)} combinations, ${String(problems)} with problems\n`,
);
if (problems > 0) process.exitCode = 1;
