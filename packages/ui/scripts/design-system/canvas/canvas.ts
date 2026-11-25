// Writes the "Shifa Components" canvas from the code (ADR-0048): one artboard per component
// (board.ts: playground, every copy, open views; theme, density, direction and view in Tweaks),
// the index board, `support/states.css` and `canvas.json` laid out by group, with the
// system's files (`ds/shifa/`) copied from `pnpm design-system:build`. Heights come from check.ts
// (heights.json; run it on the written project, then write again with the heights).
// Usage: node scripts/design-system/canvas/canvas.ts <project-dir> <current canvas.json> <heights.json>
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { makeBoard } from './board.ts';
import { GROUPS, WIDTH } from './page.ts';
import { makeMain, SHEETS } from './sheets.ts';
import { forcedStates } from './states.ts';
import type { SheetSpec } from './types.ts';

/** Sheets with nothing to press: not interactive in Play. */
const STATIC = new Set(['Icon', 'Badge', 'CountBadge', 'Avatar', 'QrCode', 'Skeleton']);
const GAP = 80;
const ROW = 4 * WIDTH + 3 * GAP;
const DESIGN_SYSTEM = {
  title: 'Shifa Design System',
  namespace: 'shifa',
  artifact: 'https://claude.ai/artifact/AzLwLVgFEH9r8pjyABR3ai',
};

/** The system as `pnpm design-system:build` wrote it: what the canvas installs (`ds/shifa/`). */
const BUILT = join(import.meta.dirname, '..', '..', '..', 'design-system', 'project');
const SYSTEM_FILES = [
  'tokens.css',
  'tokens.json',
  'fonts',
  'components/bundle.js',
  'components/bundle.css',
];

export function copySystem(project: string): void {
  if (!existsSync(join(BUILT, 'tokens.css'))) throw new Error('run pnpm design-system:build first');
  for (const file of SYSTEM_FILES) {
    cpSync(join(BUILT, file), join(project, 'ds', 'shifa', file), { recursive: true });
  }
}

interface Placed {
  file: string;
  w: number;
  h: number;
  title: string;
  interactive: boolean;
}

/** A board's height: its sheet as measured (the tallest tweak) or its tallest open view. */
export function boardHeight(spec: SheetSpec, heights: Record<string, number>): number {
  const sheet = spec.openOnly ? 0 : (heights[spec.name] ?? 1200);
  return Math.max(sheet, ...(spec.open ?? []).map((o) => o.h));
}

/** One artboard per component, with its contents, at the heights measured. */
export function artboards(
  heights: Record<string, number>,
): (Placed & { group: string; html: string })[] {
  return SHEETS.map((s) => {
    const h = boardHeight(s, heights);
    return {
      file: `${s.name}.dc.html`,
      w: WIDTH,
      h,
      title: s.name,
      interactive: !STATIC.has(s.name),
      group: s.group,
      html: makeBoard(s, h),
    };
  });
}

export function writeCanvas(
  project: string,
  current: Record<string, unknown>,
  heights: Record<string, number>,
  bundleCss: string,
): Record<string, unknown> & { order: string[] } {
  mkdirSync(join(project, 'support'), { recursive: true });
  writeFileSync(join(project, 'support', 'states.css'), forcedStates(bundleCss));
  const boards: Record<string, unknown> = {};
  const order: string[] = [];
  const notes: Record<string, unknown> = {};
  const add = (b: Placed, x: number, y: number) => {
    boards[b.file] = {
      x,
      y,
      w: b.w,
      h: b.h,
      title: b.title,
      page: 'web',
      ...(b.interactive ? { is_interactive: true } : {}),
    };
    order.push(b.file);
  };
  const mainH = heights['Main'] ?? 1000;
  writeFileSync(join(project, 'Main.dc.html'), makeMain(mainH));
  add(
    { file: 'Main.dc.html', w: WIDTH, h: mainH, title: 'Shifa Components', interactive: true },
    0,
    0,
  );
  const all = artboards(heights);
  let y = mainH + 400;
  for (const g of GROUPS) {
    const items = all.filter((b) => b.group === g);
    const count = SHEETS.filter((s) => s.group === g).length;
    notes[`g-${g.toLowerCase().replace(/\s+/g, '-')}`] = {
      x: 0,
      y: y - 260,
      text: `${g} · ${String(count)}`,
      kind: 'title1',
      maxW: ROW,
      page: 'web',
    };
    let x = 0;
    let rowH = 0;
    for (const b of items) {
      writeFileSync(join(project, b.file), b.html);
      if (x > 0 && x + b.w > ROW) {
        y += rowH + 120;
        x = 0;
        rowH = 0;
      }
      add(b, x, y);
      x += b.w + GAP;
      rowH = Math.max(rowH, b.h);
    }
    y += rowH + 400;
  }
  const kept = Object.fromEntries(
    Object.entries((current['notes'] ?? {}) as Record<string, { page?: string }>).filter(
      ([, n]) => n.page !== 'web',
    ),
  );
  const allNotes = { ...notes, ...kept };
  const keptBoards = Object.entries(
    (current['boards'] ?? {}) as Record<string, { page?: string }>,
  ).filter(([, b]) => b.page !== 'web');
  return {
    ...current,
    title: 'Shifa Components',
    launch: { view: 'canvas', page: 'web' },
    boards: { ...boards, ...Object.fromEntries(keptBoards) },
    order: [...order, ...keptBoards.map(([file]) => file)],
    notes: allNotes,
    noteOrder: Object.keys(allNotes),
  };
}

const [projectArg, indexArg, heightsArg] = process.argv.slice(2);
if (import.meta.main && projectArg && indexArg && heightsArg) {
  const project = resolve(projectArg);
  const current = JSON.parse(readFileSync(indexArg, 'utf8')) as Record<string, unknown>;
  const heights = JSON.parse(readFileSync(heightsArg, 'utf8')) as Record<string, number>;
  copySystem(project);
  const css = readFileSync(join(project, 'ds', 'shifa', 'components', 'bundle.css'), 'utf8');
  const index = writeCanvas(project, current, heights, css);
  const version = process.env['DS_VERSION'];
  if (version) {
    index['designSystems'] = [
      { ...DESIGN_SYSTEM, version, copiedAt: new Date().toISOString().replace(/\.\d+Z$/, 'Z') },
    ];
  }
  writeFileSync(join(project, 'canvas.json'), `${JSON.stringify(index, null, 1)}\n`);
  process.stdout.write(`${String(index.order.length)} boards\n`);
}
