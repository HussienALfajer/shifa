// Writes the "Clinic Web Screens" page of the "Shifa Screens · Clinic web" canvas from the code:
// the screens bundle, one artboard per board (boards.ts) and the canvas index, laid out one sheet
// per screen. Run check.ts first: it measures each board's height into heights.json.
// Usage: node scripts/screens/canvas.ts <project-dir> <current canvas.json> <heights.json>
import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { type Board, boards } from './boards.ts';
import { buildScreens } from './build.ts';
import { SHEETS } from './scenarios/index.ts';
import { PLAY_CODE, PLAY_PASSWORD } from './state.ts';

const PAGE = { id: 'screens', name: 'Clinic Web Screens' };
const DESIGN_SYSTEM = {
  title: 'Shifa Design System',
  namespace: 'shifa',
  artifact: 'https://claude.ai/artifact/AzLwLVgFEH9r8pjyABR3ai',
};
const GAP = 80;
const SHEET_GAP = 360;
const PAIRS_PER_ROW = 2;
const PHONES_PER_ROW = 8;

const escape = (s: string) =>
  s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');

const THEME_WORD = { light: 'فاتح', dark: 'داكن' } as const;

function title(b: Board): string {
  const device = b.device === 'phone' ? ' · هاتف' : '';
  return `${b.sheet.title} · ${b.scenario.title} · ${THEME_WORD[b.theme]}${device}`;
}

/**
 * One artboard: clinic web itself at the state's address, in the board's theme and window. Only
 * the app's own stylesheet: it holds the system's tokens and fonts as the app ships them (the
 * installed copy's `tokens.css` would add the same fonts a second time, from other files).
 */
function artboard(b: Board, height: number): string {
  return `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<title>${escape(`${b.sheet.title} · ${b.scenario.title}`)}</title>
<script src="./support.js"></script>
<link rel="stylesheet" href="screens/screens.css">
<script src="screens/screens.js"></script>
</head>
<body>
<x-dc>
<helmet>
<style>
html,body{margin:0}
</style>
</helmet>
<div style="width: ${String(b.width)}px; min-height: ${String(height)}px;">
  <x-import component-from-global-scope="ShifaScreens.ClinicWeb" sheet="${b.sheet.id}" state="${b.scenario.id}" theme="${b.theme}"></x-import>
</div>
</x-dc>
<script type="text/x-dc" data-dc-script data-props='{"$preview":{"width":${String(b.width)},"height":${String(height)}}}'>
class Component extends DCLogic {
  renderVals() {
    return {};
  }
}
</script>
</body>
</html>
`;
}

interface CanvasIndex {
  [key: string]: unknown;
  boards: Record<string, unknown>;
  order: string[];
  notes: Record<string, unknown>;
}

const INTRO = `Clinic Web Screens. Every board is clinic web itself (packages/web-shell, the same pages, router and Shifa components), opened at one state with a fake server that answers as the API's contracts say, with synthetic data. Nothing is drawn by hand. Each sheet is one screen: every state, light and dark, on a desktop window, and its main states on a phone. In Play: password ${PLAY_PASSWORD}, code ${PLAY_CODE}; anything else is refused as the server would. Rebuilt from the code by packages/web-shell/scripts/screens after every change to the screens (ADR-0049).`;

export function writeCanvas(
  project: string,
  current: CanvasIndex,
  heights: Record<string, number>,
) {
  const all = boards();
  const out: CanvasIndex = { ...current, boards: {}, order: [], notes: {} };
  const place = (b: Board, x: number, y: number, h: number) => {
    out.boards[b.file] = {
      x,
      y,
      w: b.width,
      h,
      title: title(b),
      page: PAGE.id,
      is_interactive: true,
    };
    out.order.push(b.file);
    writeFileSync(join(project, b.file), artboard(b, h));
  };
  const heightOf = (b: Board) =>
    b.scenario.overlay === true ? b.height : Math.max(b.height, heights[b.file] ?? b.height);
  const rowWidth = PAIRS_PER_ROW * 2 * (1440 + GAP) - GAP;
  out.notes['intro'] = {
    x: 0,
    y: 0,
    w: 1200,
    text: INTRO,
    page: PAGE.id,
    fill: 'green',
    size: 'm',
  };
  let y = 640;
  for (const sheet of SHEETS) {
    const mine = all.filter((b) => b.sheet === sheet);
    const desktop = mine.filter((b) => b.device === 'desktop');
    const phone = mine.filter((b) => b.device === 'phone');
    const states = new Set(mine.map((b) => b.scenario.id)).size;
    out.notes[`title-${sheet.id}`] = {
      x: 0,
      y: y - 260,
      text: `${sheet.title} · ${sheet.route} · ${String(states)}`,
      kind: 'title1',
      maxW: rowWidth,
      page: PAGE.id,
    };
    out.notes[`about-${sheet.id}`] = {
      x: rowWidth - 1400,
      y: y - 300,
      w: 1400,
      text: `${sheet.note} Code: ${sheet.code.map((f) => `src/${f}`).join(', ')}.`,
      page: PAGE.id,
      fill: 'yellow',
      size: 's',
    };
    // Light and dark of a state side by side, two states a row.
    for (let i = 0; i < desktop.length; i += 2 * PAIRS_PER_ROW) {
      const row = desktop.slice(i, i + 2 * PAIRS_PER_ROW);
      const h = Math.max(...row.map(heightOf));
      row.forEach((b, j) => {
        place(b, j * (1440 + GAP), y, heightOf(b));
      });
      y += h + GAP * 1.5;
    }
    for (let i = 0; i < phone.length; i += PHONES_PER_ROW) {
      const row = phone.slice(i, i + PHONES_PER_ROW);
      const h = Math.max(...row.map(heightOf));
      row.forEach((b, j) => {
        place(b, j * (390 + GAP), y, heightOf(b));
      });
      y += h + GAP * 1.5;
    }
    y += SHEET_GAP;
  }
  out.noteOrder = Object.keys(out.notes);
  out['title'] = 'Shifa Screens · Clinic web';
  out['pages'] = [PAGE];
  out['launch'] = { view: 'canvas', page: PAGE.id };
  return out;
}

const [projectArg, indexArg, heightsArg] = process.argv.slice(2);
if (import.meta.main && projectArg && indexArg && heightsArg) {
  const project = resolve(projectArg);
  await buildScreens(join(project, 'screens'));
  const current = JSON.parse(readFileSync(indexArg, 'utf8')) as CanvasIndex;
  const heights = JSON.parse(readFileSync(heightsArg, 'utf8')) as Record<string, number>;
  const version = process.env['DS_VERSION'];
  const index = writeCanvas(project, current, heights);
  if (version) {
    index['designSystems'] = [
      { ...DESIGN_SYSTEM, version, copiedAt: new Date().toISOString().replace(/\.\d+Z$/, 'Z') },
    ];
  }
  writeFileSync(join(project, 'canvas.json'), `${JSON.stringify(index, null, 1)}\n`);
  console.log(`${String(index.order.length)} boards in ${String(SHEETS.length)} sheets`);
}
