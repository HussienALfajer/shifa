#!/usr/bin/env node
// Builds the static record of the design directions (spec 0.4 criterion 4, slice 0.4-02):
// design/directions/source/*.dc.html (the artboards as drawn in the design canvas)
//   -> design/directions/<a|b|c|d>/<screen>.html, runtime.js and fonts/.
// Each page holds its first state as plain HTML, opens from disk without a server and makes no
// network request. Run it again after changing a source file; never edit the builds by hand.
import { copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DCLogic, parseTemplate, renderTemplate } from './lib/dc-static.mjs';

const root = join(import.meta.dirname, '..');
const directionsDir = join(root, 'design', 'directions');
const sourceDir = join(directionsDir, 'source');
const fontsDir = join(root, 'packages', 'tokens', 'fonts');

const DIRECTIONS = { a: 'الدقيق', b: 'الهادئ', c: 'الدافئ', d: 'أرض الديار' };
const SCREENS = [
  { stem: 'Queue', file: 'reception-queue.html', label: 'دور الاستقبال', fixed: false },
  { stem: 'Visit', file: 'doctor-visit.html', label: 'زيارة الطبيب', fixed: false },
  {
    stem: 'Visit-Tablet',
    file: 'doctor-visit-tablet.html',
    label: 'الزيارة على اللوحي',
    fixed: true,
  },
  { stem: 'Booking', file: 'patient-booking.html', label: 'حجز المريض', fixed: true },
];
/** The canvas names its entry artboard Main; it is direction D's reception queue. */
const sourceName = (id, stem) =>
  id === 'd' && stem === 'Queue' ? 'Main.dc.html' : `${id.toUpperCase()}-${stem}.dc.html`;

const between = (text, open, close) => {
  const from = text.indexOf(open);
  const to = text.indexOf(close, from + open.length);
  if (from === -1 || to === -1) throw new Error(`missing ${open} … ${close}`);
  return text.slice(from + open.length, to);
};

const PAGE_CSS = `
html{background:#d9d5cb}
#dc-bar{display:flex;flex-wrap:wrap;align-items:center;gap:6px 14px;padding:8px 16px;background:#1d2a26;color:#e6ede9;font:14px/1.6 'IBM Plex Sans Arabic',system-ui,sans-serif}
#dc-bar strong{font-weight:600}
#dc-bar a{color:#a9cfc3;text-decoration:none;padding:4px 6px;border-radius:4px}
#dc-bar a[aria-current="page"]{color:#fff;background:rgba(255,255,255,.12)}
#dc-bar button{font:inherit;color:#1d2a26;background:#e6ede9;border:0;border-radius:4px;padding:4px 10px;cursor:pointer}
#dc-bar a:focus-visible,#dc-bar button:focus-visible{outline:2px solid #d4b463;outline-offset:2px}
#dc-bar .dc-push{margin-inline-start:auto}
#dc-root.dc-fixed{display:flex;justify-content:center;padding:24px 0}
`;

const fontFaces = () => {
  const { families } = JSON.parse(readFileSync(join(fontsDir, 'fonts.json'), 'utf8'));
  const faces = [];
  const files = [];
  for (const family of families) {
    // OFL condition 2: the licence travels with every copy of the fonts.
    files.push([join(fontsDir, family.licence), `${family.id}-OFL.txt`]);
    for (const file of family.files.filter((f) => f.format === 'woff2')) {
      const name = file.path.split('/').pop();
      files.push([join(fontsDir, file.path), name]);
      faces.push(
        `@font-face{font-family:'${family.family}';font-weight:${file.weight};font-display:swap;src:url('${name}') format('woff2');unicode-range:${file.unicodeRange}}`,
      );
    }
  }
  return { css: `${faces.join('\n')}\n`, files };
};

const page = (id, screen) => {
  const source = readFileSync(join(sourceDir, sourceName(id, screen.stem)), 'utf8');
  const body = between(source, '<x-dc>', '</x-dc>').replace(
    /(?:Main|[A-D]-(Queue|Visit-Tablet|Visit|Booking))\.dc\.html/g,
    (_, stem) => SCREENS.find((s) => s.stem === (stem ?? 'Queue')).file,
  );
  const style = between(body, '<style>', '</style>');
  const template = body.replace(/<helmet>[\s\S]*?<\/helmet>/, '').trim();
  const code = between(source, 'data-dc-script', '</script>').replace(/^[^>]*>/, '');
  const title = between(source, '<title>', '</title>');

  const Component = new Function('DCLogic', `${code}\nreturn Component;`)(DCLogic);
  const first = renderTemplate(parseTemplate(template), new Component({}).renderVals(), []);

  const links = SCREENS.map(
    (s) => `<a href="${s.file}"${s === screen ? ' aria-current="page"' : ''}>${s.label}</a>`,
  ).join('');
  return `<!doctype html>
<html lang="ar" dir="rtl" data-theme="light" data-density="comfortable">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<link rel="stylesheet" href="fonts/fonts.css">
<style>${PAGE_CSS}${style}</style>
</head>
<body>
<nav id="dc-bar" aria-label="شاشات الاتجاه">
<strong>${id.toUpperCase()} · ${DIRECTIONS[id]}</strong>
${links}
<button type="button" class="dc-push" data-dc-set="theme light dark">فاتح / داكن</button>
<button type="button" data-dc-set="density comfortable compact">مريح / مضغوط</button>
</nav>
<div id="dc-root"${screen.fixed ? ' class="dc-fixed"' : ''}>${first}</div>
<script type="application/json" id="dc-template">${JSON.stringify(template).replaceAll('<', '\\u003c')}</script>
<script src="runtime.js"></script>
<script>
${code.trim()}
DC.mount(Component);
</script>
</body>
</html>
`;
};

const runtime = () => {
  const lib = readFileSync(join(import.meta.dirname, 'lib', 'dc-static.mjs'), 'utf8');
  return `// Generated by scripts/design-directions-build.mjs from scripts/lib/dc-static.mjs.
var DC = (function () {
${lib.replaceAll(/^export /gm, '')}
globalThis.DCLogic = DCLogic;
return { mount };
})();
`;
};

const fonts = fontFaces();
for (const id of Object.keys(DIRECTIONS)) {
  const out = join(directionsDir, id);
  rmSync(out, { recursive: true, force: true });
  mkdirSync(join(out, 'fonts'), { recursive: true });
  for (const screen of SCREENS) writeFileSync(join(out, screen.file), page(id, screen));
  writeFileSync(join(out, 'runtime.js'), runtime());
  writeFileSync(join(out, 'fonts', 'fonts.css'), fonts.css);
  for (const [from, name] of fonts.files) copyFileSync(from, join(out, 'fonts', name));
  process.stdout.write(`built design/directions/${id} (${SCREENS.length} screens)\n`);
}
