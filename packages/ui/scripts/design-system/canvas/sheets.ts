// Every sheet of the "Shifa Components" page, in the system's order, and the index board.
import { esc, GROUPS, page, WIDTH } from './page.ts';
import { ACTIONS } from './sheets-actions.ts';
import { CHOICES } from './sheets-choices.ts';
import { DISPLAY, FEEDBACK } from './sheets-display.ts';
import { FIELDS } from './sheets-fields.ts';
import { NAVIGATION } from './sheets-navigation.ts';
import { OVERLAYS } from './sheets-overlays.ts';
import type { SheetSpec } from './types.ts';

export const SHEETS: SheetSpec[] = [
  ...ACTIONS,
  ...FIELDS,
  ...CHOICES,
  ...NAVIGATION,
  ...OVERLAYS,
  ...DISPLAY,
  ...FEEDBACK,
];

const MUTED = 'color: var(--shifa-color-text-muted);';
const card = (title: string, text: string) =>
  `    <div style="display: flex; flex-direction: column; gap: 6px; padding: 20px 24px; border-radius: 12px; border: 1px solid var(--shifa-color-border-default);"><strong style="font-size: 15px;">${title}</strong><span style="font-size: 14px; line-height: 1.6; ${MUTED}">${text}</span></div>`;

/** The index board: what the page is and a link to every sheet, by group. */
export function makeMain(h: number): string {
  const groups = GROUPS.map((g) => {
    const items = SHEETS.filter((s) => s.group === g);
    const links = items
      .map(
        (s) =>
          `        <a href="${s.name}.dc.html" style="font-size: 15px; font-weight: 500; text-decoration: none;">${esc(s.name)}</a>`,
      )
      .join('\n');
    return `    <div style="display: flex; flex-direction: column; gap: 12px; padding: 24px; border-radius: 12px; background: var(--shifa-color-bg-surface); border: 1px solid var(--shifa-color-border-default);">
      <strong style="font-size: 16px; font-weight: 600;">${g} <span style="font-weight: 400; ${MUTED}">· ${String(items.length)}</span></strong>
      <div style="display: flex; flex-wrap: wrap; gap: 8px 20px;">
${links}
      </div>
    </div>`;
  }).join('\n');
  return page({
    title: 'Shifa Components',
    w: WIDTH,
    h,
    logic: '    return { v: {} };',
    body: `<div data-theme="light" style="width: ${String(WIDTH)}px; height: ${String(h)}px; box-sizing: border-box; padding: 64px 80px; display: flex; flex-direction: column; gap: 32px; background: var(--shifa-color-bg-app); color: var(--shifa-color-text-default); font-family: var(--font-sans);">
  <div style="display: flex; flex-direction: column; gap: 12px; max-width: 980px;">
    <p style="margin: 0; font-size: 14px; font-weight: 500; ${MUTED}">SHIFA DESIGN SYSTEM · WEB</p>
    <h1 style="margin: 0; font-size: 44px; line-height: 1.3; font-weight: 700;">Shifa Components</h1>
    <p style="margin: 0; font-size: 18px; line-height: 1.6; ${MUTED}">One sheet per component of the Shifa Design System: every variant, size and state in Arabic, right to left, light and dark, comfortable and compact. Nothing here is drawn by hand: each copy is the real component from the system’s code (packages/ui), mounted from its bundle, so a component that uses another (a busy Button and its Spinner, a field and its icons, a dialog and its buttons) shows that one too.</p>
  </div>
  <div style="display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 20px;">
${card('Play', 'Every sheet works in Play: press, type, open menus and dialogs, move with Tab and the arrows.')}
${card('Fixed states', 'Hover, pressed and focus copies use the component’s own CSS rules, switched on for display.')}
${card('Synthetic data', 'Names, numbers and records are invented. Never a real patient.')}
  </div>
  <div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 20px;">
${groups}
  </div>
</div>`,
  });
}
