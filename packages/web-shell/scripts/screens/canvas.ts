// Writes the "Clinic Web Screens" page of the "Shifa Screens · Clinic web" canvas from the code:
// the screens bundle, two artboards per screen (a desktop window and a phone, boards.ts) whose
// state and theme are chosen in the canvas's Tweaks panel, and the canvas index, one row per
// screen. Run check.ts first: it measures every state's height into heights.json. The boards
// published now sit beside the current canvas.json (as the Artifact tool saves them): the state
// and theme the owner saved in their Tweaks are carried into the new boards, and every page but
// this one is kept as it is. With `admin`, the same for the "Admin Web Screens" page of
// "Shifa Screens · Admin web" (CANVASES: the old A-01-10 page dropped, a Proposals page added).
// Usage: node scripts/screens/canvas.ts <project-dir> <current canvas.json> <heights.json> [admin]
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { type Board, boards, boardWidth, heightKey } from './boards.ts';
import { buildScreens } from './build.ts';
import { SHEETS_OF } from './scenarios/index.ts';
import { PLAY_CODE, PLAY_PASSWORD, type ScreensApp } from './state.ts';

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

/** The Tweaks a board was published with: the owner's saved state and theme. */
export interface Saved {
  state?: string;
  theme?: string;
}

/** Reads `data-props`' defaults from a published board (either quoting of the attribute). */
export function savedTweaks(html: string): Saved {
  const single = /data-props='([^']*)'/.exec(html)?.[1];
  const double = /data-props="([^"]*)"/.exec(html)?.[1];
  const raw = single ?? double?.replaceAll('&quot;', '"').replaceAll('&amp;', '&');
  if (raw === undefined) return {};
  let props: Record<string, { default?: unknown }>;
  try {
    props = JSON.parse(raw.replaceAll('&#39;', "'")) as Record<string, { default?: unknown }>;
  } catch {
    // A board the canvas wrote in another shape: its Tweaks start from the defaults.
    return {};
  }
  const pick = (k: string) => {
    const value = props[k]?.default;
    return typeof value === 'string' ? value : undefined;
  };
  const state = pick('state');
  const theme = pick('theme');
  return { ...(state ? { state } : {}), ...(theme ? { theme } : {}) };
}

/**
 * One artboard: clinic web itself in a window of the device's width, at the state and in the theme
 * chosen in Tweaks, and the state panel at its right (panel.tsx). Only the app's own stylesheet:
 * it holds the system's tokens and fonts as the app ships them (the installed copy's `tokens.css`
 * would add the same fonts a second time, from other files).
 */
export function artboard(b: Board, height: number, saved: Saved = {}): string {
  const first = b.states[0]?.id ?? '';
  // A saved state that no longer exists (renamed) falls back to the first.
  const state = b.states.some((s) => s.id === saved.state) ? (saved.state ?? first) : first;
  const theme = saved.theme === 'dark' ? 'dark' : 'light';
  const width = boardWidth(b.device);
  const props = {
    state: {
      editor: 'enum',
      options: b.states.map((s) => ({ value: s.id, label: s.title })),
      default: state,
    },
    theme: {
      editor: 'enum',
      options: [
        { value: 'light', label: 'فاتح' },
        { value: 'dark', label: 'داكن' },
      ],
      default: theme,
    },
    $preview: { width, height },
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
<div style="width: ${String(width)}px; min-height: ${String(height)}px;">
  <x-import component-from-global-scope="ShifaScreens.Board" sheet="${b.sheet.id}" width="${String(b.width)}" height="${String(height)}" state="{{state}}" theme="{{theme}}"></x-import>
</div>
</x-dc>
<script type="text/x-dc" data-dc-script data-props='${attrJson(props)}'>
class Component extends DCLogic {
  renderVals() {
    return { state: this.props.state ?? '${state}', theme: this.props.theme ?? '${theme}' };
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

const intro = (name: string, app: string) =>
  `${name}. One sheet per screen: the screen on a desktop window and on a phone. Select a board and open Tweaks to choose the state it opens at (every state the screen can show and every answer of the server) and the light or dark theme; in Play, the panel at the right of each board restarts the app at any state or theme without changing Tweaks, and «Reset» goes back to them. Every board is ${app} itself (packages/web-shell: the same pages, router and Shifa components), opened at that state with a fake server that answers as the API's contracts say, with synthetic data; nothing is drawn by hand. In Play: password ${PLAY_PASSWORD}, code ${PLAY_CODE}; anything else is refused as the server would. Rebuilt from the code by packages/web-shell/scripts/screens (ADR-0049).`;

interface Page {
  id: string;
  name: string;
}

/**
 * Drawings on "Proposals" whose screens are now coded and on the screens page (ADR-0049): their
 * boards and notes are removed, and what stays on that page moves up into the space they held.
 */
export interface Retired {
  page: string;
  boards: RegExp;
  notes: RegExp;
}

/** Each app's canvas: its screens page, its title, pages it drops or adds, drawings it retires. */
export const CANVASES: Record<
  ScreensApp,
  { page: Page; title: string; intro: string; drop: string[]; add: Page[]; retire: Retired[] }
> = {
  clinic: {
    page: { id: 'screens', name: 'Clinic Web Screens' },
    title: 'Shifa Screens · Clinic web',
    intro: intro('Clinic Web Screens', 'clinic web'),
    drop: [],
    add: [],
    // A-02-01's clinic web drawings, coded by A-02-10 (owner, 2026-11-27); A-03's stay.
    retire: [{ page: 'proposals', boards: /^A02c/, notes: /^a02c-/ }],
  },
  admin: {
    page: { id: 'admin-screens', name: 'Admin Web Screens' },
    title: 'Shifa Screens · Admin web',
    intro: `${intro('Admin Web Screens', 'admin web')} Admin web is drawn for the desktop; its phone boards show how it renders in a phone's window.`,
    // The A-01-10 prototype, replaced by the coded screens (owner, 2026-11-26).
    drop: ['a0110'],
    add: [{ id: 'proposals', name: 'Proposals' }],
    // A-02-01's admin web drawings, coded by A-02-08 and A-02-09 (owner, 2026-11-27).
    retire: [{ page: 'proposals', boards: /^A02/, notes: /^a02-/ }],
  },
};

interface Placed {
  page?: string;
  y?: number;
}

/**
 * Removes the retired boards and notes; the rest of their page moves up by the height they held
 * above it, so the page starts where the first retired drawing did.
 */
export function retire(index: CanvasIndex, rules: Retired[]): CanvasIndex {
  let out = index;
  for (const rule of rules) {
    const on = (v: unknown) => (v as Placed).page === rule.page;
    const gone = (record: Record<string, unknown>, re: RegExp) =>
      Object.keys(record).filter((k) => on(record[k]) && re.test(k));
    const goneBoards = new Set(gone(out.boards, rule.boards));
    const goneNotes = new Set(gone(out.notes, rule.notes));
    const ys = (record: Record<string, unknown>, keys: (k: string) => boolean) =>
      Object.entries(record)
        .filter(([k, v]) => on(v) && keys(k))
        .map(([, v]) => (v as Placed).y ?? 0);
    const removedYs = [
      ...ys(out.boards, (k) => goneBoards.has(k)),
      ...ys(out.notes, (k) => goneNotes.has(k)),
    ];
    const keptYs = [
      ...ys(out.boards, (k) => !goneBoards.has(k)),
      ...ys(out.notes, (k) => !goneNotes.has(k)),
    ];
    const top = Math.min(...removedYs);
    const keptTop = Math.min(...keptYs);
    const shift = removedYs.length > 0 && keptYs.length > 0 && top < keptTop ? keptTop - top : 0;
    const keep = (record: Record<string, unknown>, goneKeys: Set<string>) =>
      Object.fromEntries(
        Object.entries(record)
          .filter(([k]) => !goneKeys.has(k))
          .map(([k, v]) =>
            on(v) && shift > 0
              ? [k, { ...(v as object), y: ((v as Placed).y ?? 0) - shift }]
              : [k, v],
          ),
      );
    out = {
      ...out,
      boards: keep(out.boards, goneBoards),
      notes: keep(out.notes, goneNotes),
      order: out.order.filter((f) => !goneBoards.has(f)),
    };
    const noteOrder = out['noteOrder'] as string[] | undefined;
    if (noteOrder) out['noteOrder'] = noteOrder.filter((k) => !goneNotes.has(k));
  }
  return out;
}

const pageOf = (entry: unknown) => (entry as { page?: string } | undefined)?.page;

/** The board files a new index no longer holds (for the publish to remove them). */
export function removedFiles(before: CanvasIndex, after: CanvasIndex): string[] {
  return Object.keys(before.boards).filter((f) => !(f in after.boards));
}

export function writeCanvas(
  project: string,
  read: CanvasIndex,
  heights: Record<string, number>,
  saved: (file: string) => Saved = () => ({}),
  app: ScreensApp = 'clinic',
) {
  const { page: PAGE, title, intro: INTRO, drop, add, retire: retired } = CANVASES[app];
  const current = retire(read, retired);
  const SHEETS = SHEETS_OF[app];
  const onPage = (entry: unknown) => pageOf(entry) === PAGE.id;
  const gone = (entry: unknown) => onPage(entry) || drop.includes(pageOf(entry) ?? '');
  const others = <T>(record: Record<string, T>) =>
    Object.fromEntries(Object.entries(record).filter(([, v]) => !gone(v)));
  // The other pages (Proposals) keep their boards, notes and order as read; dropped pages go.
  const out: CanvasIndex = {
    ...current,
    boards: others(current.boards),
    order: current.order.filter((f) => !gone(current.boards[f])),
    notes: others(current.notes),
  };
  const rowWidth = boardWidth('desktop') + GAP + boardWidth('phone') + GAP + NOTE_W;
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
      const w = boardWidth(b.device);
      out.boards[b.file] = {
        x,
        y,
        w,
        h,
        title: `${sheet.title} · ${DEVICE_WORD[b.device]} · ${statesWord(b.states.length)}`,
        page: PAGE.id,
        is_interactive: true,
      };
      out.order.push(b.file);
      writeFileSync(join(project, b.file), artboard(b, h, saved(b.file)));
      x += w + GAP;
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
  const noteOrder = (current['noteOrder'] as string[] | undefined) ?? [];
  out['noteOrder'] = [
    ...noteOrder.filter((k) => k in out.notes && !onPage(out.notes[k])),
    ...Object.keys(out.notes).filter((k) => onPage(out.notes[k])),
  ];
  out['title'] = title;
  const pages = ((current['pages'] as Page[] | undefined) ?? []).filter(
    (p) => !drop.includes(p.id),
  );
  const withScreens = pages.some((p) => p.id === PAGE.id)
    ? pages.map((p) => (p.id === PAGE.id ? { ...p, ...PAGE } : p))
    : [PAGE, ...pages];
  out['pages'] = [...withScreens, ...add.filter((p) => !withScreens.some((q) => q.id === p.id))];
  const launch = current['launch'] as { page?: string } | undefined;
  out['launch'] =
    launch && !drop.includes(launch.page ?? '') ? launch : { view: 'canvas', page: PAGE.id };
  return out;
}

const [projectArg, indexArg, heightsArg, appArg] = process.argv.slice(2);
if (import.meta.main && projectArg && indexArg && heightsArg) {
  const asked = appArg ?? 'clinic';
  // A typo must never rewrite one app's canvas with the other's sheets.
  if (asked !== 'clinic' && asked !== 'admin') {
    throw new Error(`canvas.ts: unknown app ${asked} (clinic or admin)`);
  }
  const app: ScreensApp = asked;
  const project = resolve(projectArg);
  await buildScreens(join(project, 'screens'));
  const current = JSON.parse(readFileSync(indexArg, 'utf8')) as CanvasIndex;
  const heights = JSON.parse(readFileSync(heightsArg, 'utf8')) as Record<string, number>;
  const version = process.env['DS_VERSION'];
  const published = dirname(resolve(indexArg));
  const index = writeCanvas(
    project,
    current,
    heights,
    (file) => {
      const path = join(published, file);
      return existsSync(path) ? savedTweaks(readFileSync(path, 'utf8')) : {};
    },
    app,
  );
  if (version) {
    index['designSystems'] = [
      { ...DESIGN_SYSTEM, version, copiedAt: new Date().toISOString().replace(/\.\d+Z$/, 'Z') },
    ];
  }
  writeFileSync(join(project, 'canvas.json'), `${JSON.stringify(index, null, 1)}\n`);
  const removed = removedFiles(current, index);
  process.stdout.write(
    `${String(index.order.length)} boards in ${String(SHEETS_OF[app].length)} sheets` +
      (removed.length > 0 ? `; removed: ${removed.join(', ')}` : '') +
      '\n',
  );
}
