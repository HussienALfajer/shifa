// The boards of the "Clinic Web Screens" page: one sheet per screen, a desktop window (1440) and a
// phone (390), each showing any state of the screen in either theme, chosen in the canvas's Tweaks
// panel (ADR-0049). `renders()` lists every state, device and theme the check opens.

import type { Scenario, Sheet } from './scenario.ts';
import { SHEETS } from './scenarios/index.ts';

export type Theme = 'light' | 'dark';
export type Device = 'desktop' | 'phone';

export const WINDOW: Record<Device, { width: number; height: number }> = {
  desktop: { width: 1440, height: 900 },
  phone: { width: 390, height: 844 },
};

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** The states of a sheet on a device: a phone-only state is not drawn on a desktop. */
export const statesOn = (sheet: Sheet, device: Device): Scenario[] =>
  sheet.scenarios.filter((s) => device === 'phone' || s.phone !== 'only');

/** One artboard of the canvas: a screen on a device. */
export interface Board {
  /** e.g. `SignInDesktop.dc.html`. */
  file: string;
  sheet: Sheet;
  device: Device;
  width: number;
  /** The window's height; the board takes its tallest state's. */
  height: number;
  states: Scenario[];
}

export function boards(sheets: Sheet[] = SHEETS): Board[] {
  return sheets.flatMap((sheet) =>
    (['desktop', 'phone'] as const).map((device) => ({
      file: `${sheet.id}${cap(device)}.dc.html`,
      sheet,
      device,
      ...WINDOW[device],
      states: statesOn(sheet, device),
    })),
  );
}

/** One state opened by the check: a screen, a state, a device and a theme. */
export interface Render {
  /** e.g. `SignInWrongDarkPhone`; the screenshot's name. */
  key: string;
  sheet: Sheet;
  scenario: Scenario;
  device: Device;
  theme: Theme;
  width: number;
  height: number;
}

/** The height key of a state on a device (the same in both themes). */
export const heightKey = (sheet: Sheet, scenario: Scenario, device: Device) =>
  `${sheet.id}${scenario.id}${cap(device)}`;

export function renders(sheets: Sheet[] = SHEETS): Render[] {
  return boards(sheets).flatMap((b) =>
    b.states.flatMap((scenario) =>
      (['light', 'dark'] as const).map((theme) => ({
        key: `${b.sheet.id}${scenario.id}${cap(theme)}${cap(b.device)}`,
        sheet: b.sheet,
        scenario,
        device: b.device,
        theme,
        width: b.width,
        height: b.height,
      })),
    ),
  );
}
