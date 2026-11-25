// The boards of the "Clinic Web Screens" page: every state of every sheet on a desktop window
// (1440 wide) in the light and the dark theme, and the sheet's main states on a phone (390).
import { SHEETS } from './scenarios/index.ts';
import type { Scenario, Sheet } from './scenario.ts';

export type Theme = 'light' | 'dark';
export type Device = 'desktop' | 'phone';

export interface Board {
  /** The artboard's file, e.g. `SignInWrongDarkDesktop.dc.html`. */
  file: string;
  sheet: Sheet;
  scenario: Scenario;
  theme: Theme;
  device: Device;
  /** The window: 1440 × 900 on a desktop, 390 × 844 on a phone. */
  width: number;
  /** The window's height; a board without an overlay grows to the page's height. */
  height: number;
}

export const WINDOW: Record<Device, { width: number; height: number }> = {
  desktop: { width: 1440, height: 900 },
  phone: { width: 390, height: 844 },
};

const THEMES: Theme[] = ['light', 'dark'];
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function boards(sheets: Sheet[] = SHEETS): Board[] {
  const all: Board[] = [];
  for (const sheet of sheets) {
    for (const device of ['desktop', 'phone'] as const) {
      for (const scenario of sheet.scenarios) {
        const drawn =
          device === 'desktop'
            ? scenario.phone !== 'only'
            : scenario.phone !== undefined && scenario.phone !== false;
        if (!drawn) continue;
        for (const theme of THEMES) {
          all.push({
            file: `${sheet.id}${scenario.id}${cap(theme)}${cap(device)}.dc.html`,
            sheet,
            scenario,
            theme,
            device,
            ...WINDOW[device],
          });
        }
      }
    }
  }
  return all;
}
