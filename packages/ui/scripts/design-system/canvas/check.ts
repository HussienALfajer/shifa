// Opens every artboard of the "Shifa Components" canvas in Chromium as the canvas does (x-import →
// the bundle's component in a display:contents span, with the project's tokens, bundle and states
// stylesheet) and reports a missing component or value, an error, content wider than its panel,
// and content taller than its board. With --measure it writes each board's natural height to
// heights.json for canvas.ts. Usage:
// node scripts/design-system/canvas/check.ts <project-dir> <heights.json> [--measure] [name-prefix…]
import { createReadStream, existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, resolve } from 'node:path';
import { chromium } from 'playwright';

const [projectArg, heightsArg, ...flags] = process.argv.slice(2);
if (!projectArg || !heightsArg)
  throw new Error('usage: check.ts <project-dir> <heights.json> [--measure] [prefix…]');
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

interface Result {
  missing: string[];
  over: string[];
  natural: number | null;
  content: number;
  frame: number;
}

const browser = await chromium.launch();
const heights: Record<string, number> = {};
let problems = 0;
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
  const preview = (
    JSON.parse(/data-props='([^']*)'/.exec(html)?.[1] ?? '{}') as {
      $preview: { width: number; height: number };
    }
  ).$preview;
  const page = await browser.newPage({
    viewport: { width: preview.width, height: preview.height },
  });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning')
      errors.push(`${m.type()}: ${m.text().slice(0, 200)}`);
  });
  await page.goto(`${base}ds/shifa/tokens.css`);
  await page.setContent(
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><base href="${base}"><link rel="stylesheet" href="ds/shifa/tokens.css"><link rel="stylesheet" href="ds/shifa/components/bundle.css"><link rel="stylesheet" href="support/states.css"><script src="ds/shifa/components/bundle.js"></script>${helmet}</head><body><template id="t">${body}</template><div id="root"></div></body></html>`,
  );
  await page.waitForLoadState('load');
  await page.evaluate(async () => {
    await Promise.all([...document.fonts].map((x) => x.load()));
  });
  // Runs in the page: mounts each x-import as the canvas runtime does, then measures.
  const result = await page.evaluate(
    async ({ src, measureHeight }: { src: string; measureHeight: boolean }): Promise<Result> => {
      class DCLogic {}
      (globalThis as unknown as { DCLogic: typeof DCLogic }).DCLogic = DCLogic;
      // biome-ignore lint/security/noGlobalEval: the artboard's own logic class, as the canvas runs it
      const Logic = (0, eval)(
        `(${src.replace('class Component extends DCLogic', 'class extends DCLogic')})`,
      ) as new () => {
        renderVals: () => { v?: Record<string, unknown> };
      };
      const vals = new Logic().renderVals().v ?? {};
      const root = document.getElementById('root') as HTMLElement;
      root.append((document.getElementById('t') as HTMLTemplateElement).content.cloneNode(true));
      const camel = (k: string) =>
        k.startsWith('aria-') || k.startsWith('data-')
          ? k
          : k.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
      const shifa = (
        globalThis as unknown as {
          Shifa: Record<string, unknown> & { mount: (e: Element, n: string, p: object) => void };
        }
      ).Shifa;
      const missing: string[] = [];
      for (const el of [...root.querySelectorAll('x-import')]) {
        const name = (el.getAttribute('component-from-global-scope') ?? '').replace('Shifa.', '');
        const props: Record<string, unknown> = {};
        for (const a of el.attributes) {
          if (a.name === 'component-from-global-scope' || a.name === 'style') continue;
          const bound = /^\{\{\s*v\.(\w+)\s*\}\}$/.exec(a.value)?.[1];
          if (bound !== undefined && !(bound in vals)) missing.push(bound);
          props[camel(a.name)] = bound === undefined ? a.value : vals[bound];
        }
        if ((el.textContent ?? '').trim()) props['children'] = el.textContent;
        const span = document.createElement('span');
        span.style.display = 'contents';
        el.replaceWith(span);
        if (!shifa[name]) missing.push(`component ${name}`);
        shifa.mount(span, name, props);
      }
      await new Promise((r) => setTimeout(r, 900));
      const frame = root.firstElementChild as HTMLElement;
      const top = frame.getBoundingClientRect().top;
      const over = new Set<string>();
      for (const el of frame.querySelectorAll('section, section *')) {
        if (el.closest('[popover]')) continue;
        const panel = (el.closest('section') as HTMLElement).getBoundingClientRect();
        const r = el.getBoundingClientRect();
        if (r.width > 0 && (r.right > panel.right + 0.5 || r.left < panel.left - 0.5)) {
          over.add(`${el.tagName} «${(el.textContent ?? '').trim().slice(0, 24)}»`);
        }
      }
      let natural: number | null = null;
      if (measureHeight) {
        const keep = frame.style.height;
        frame.style.height = 'auto';
        natural = Math.ceil(frame.getBoundingClientRect().height);
        frame.style.height = keep;
      }
      const content =
        Math.max(...[...frame.children].map((e) => e.getBoundingClientRect().bottom)) - top;
      return {
        missing,
        over: [...over].slice(0, 6),
        natural,
        content: Math.round(content),
        frame: frame.getBoundingClientRect().height,
      };
    },
    { src: script, measureHeight: measure },
  );
  const key = f.replace('.dc.html', '');
  if (result.natural !== null) heights[key] = result.natural;
  const taller = !measure && result.content > result.frame + 1;
  if (result.missing.length > 0 || result.over.length > 0 || errors.length > 0 || taller) {
    problems += 1;
    console.log(
      `${key}: ${[...result.missing.map((m) => `missing ${m}`), ...result.over.map((o) => `over ${o}`), ...errors, ...(taller ? ['taller than its board'] : [])].join(' | ')}`,
    );
  }
  await page.close();
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
console.log(`${String(files.length)} boards, ${String(problems)} with problems`);
if (problems > 0) process.exitCode = 1;
