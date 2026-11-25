// Writes the "Clinic Web Screens" page of the "Shifa Screens · Clinic web" canvas from the code:
// the screens bundle, two artboards per screen (a desktop window and a phone, boards.ts) whose
// state and theme are chosen in the canvas's Tweaks panel, and the canvas index, one row per
// screen. Run check.ts first: it measures every state's height into heights.json.
// Usage: node scripts/screens/canvas.ts <project-dir> <current canvas.json> <heights.json>
import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { type Board, boards, heightKey, WINDOW } from './boards.ts';
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
const ROW_GAP = 480;
const NOTE_W = 560;

const escape = (s: string) =>
  s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
/** JSON inside a single-quoted attribute. */
const attrJson = (value: unknown) => JSON.stringify(value).replaceAll("'", '\\u0027');

const DEVICE_WORD = { desktop: 'سطح المكتب', phone: 'هاتف' } as const;

/** «3 حالات» to «10 حالات», «11 حالة» and on (every sheet has at least three). */
const statesWord = (n: number) => `${String(n)} ${n >= 3 && n <= 10 ? 'حالات' : 'حالة'}`;

/** The board's height: its tallest state, a dialog's state one window high. */
function heightOf(b: Board, heights: Record<string, number>): number {
  const tallest = b.states.map((s) =>
    s.overlay === true ? b.height : (heights[heightKey(b.sheet, s, b.device)] ?? b.height),
  );
  return Math.max(b.height, ...tallest);
}

/**
 * One artboard: clinic web itself, at the state and in the theme chosen in Tweaks, in the board's
 * window. Only the app's own stylesheet: it holds the system's tokens and fonts as the app ships
 * them (the installed copy's `tokens.css` would add the same fonts a second time, from other files).
 */
function artboard(b: Board, height: number): string {
  const first = b.states[0]?.id ?? '';
  const props = {
    state: {
      editor: 'enum',
      options: b.states.map((s) => ({ value: s.id, label: s.title })),
      default: first,
    },
    theme: {
      editor: 'enum',
      options: [
        { value: 'light', label: 'فاتح' },
        { value: 'dark', label: 'داكن' },
      ],
      default: 'light',
    },
    $preview: { width: b.width, height },
  };
  return `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<title>${escape(`${b.sheet.title} · ${DEVICE_WORD[b.device]}`)}</title>
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
  <x-import component-from-global-scope="ShifaScreens.ClinicWeb" sheet="${b.sheet.id}" state="{{state}}" theme="{{theme}}"></x-import>
</div>
</x-dc>
<script type="text/x-dc" data-dc-script data-props='${attrJson(props)}'>
class Component extends DCLogic {
  renderVals() {
    return { state: this.props.state ?? '${first}', theme: this.props.theme ?? 'light' };
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

const INTRO = `Clinic Web Screens. One sheet per screen: the screen on a desktop window and on a phone. Select a board and open Tweaks to choose any of its states (every state the screen can show and every answer of the server) and the light or dark theme. Every board is clinic web itself (packages/web-shell: the same pages, router and Shifa components), opened at that state with a fake server that answers as the API's contracts say, with synthetic data; nothing is drawn by hand. In Play: password ${PLAY_PASSWORD}, code ${PLAY_CODE}; anything else is refused as the server would. Rebuilt from the code by packages/web-shell/scripts/screens (ADR-0049).`;

export function writeCanvas(
  project: string,
  current: CanvasIndex,
  heights: Record<string, number>,
) {
  const out: CanvasIndex = { ...current, boards: {}, order: [], notes: {} };
  const rowWidth = WINDOW.desktop.width + GAP + WINDOW.phone.width + GAP + NOTE_W;
  out.notes['intro'] = {
    x: 0,
    y: 0,
    w: 1200,
    text: INTRO,
    page: PAGE.id,
    fill: 'green',
    size: 'm',
  };
  let y = 700;
  for (const sheet of SHEETS) {
    const [desktop, phone] = boards([sheet]);
    if (!desktop || !phone) continue;
    out.notes[`title-${sheet.id}`] = {
      x: 0,
      y: y - 260,
      text: `${sheet.title} · ${sheet.route} · ${String(sheet.scenarios.length)}`,
      kind: 'title1',
      maxW: rowWidth,
      page: PAGE.id,
    };
    let x = 0;
    let rowH = 0;
    for (const b of [desktop, phone]) {
      const h = heightOf(b, heights);
      out.boards[b.file] = {
        x,
        y,
        w: b.width,
        h,
        title: `${sheet.title} · ${DEVICE_WORD[b.device]} · ${statesWord(b.states.length)}`,
        page: PAGE.id,
        is_interactive: true,
      };
      out.order.push(b.file);
      writeFileSync(join(project, b.file), artboard(b, h));
      x += b.width + GAP;
      rowH = Math.max(rowH, h);
    }
    out.notes[`about-${sheet.id}`] = {
      x,
      y,
      w: NOTE_W,
      text: `${sheet.note} Code: ${sheet.code.map((f) => `src/${f}`).join(', ')}.`,
      page: PAGE.id,
      fill: 'yellow',
      size: 's',
    };
    y += rowH + ROW_GAP;
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
