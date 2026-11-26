// A state of a clinic-web screen on the canvas: where the app opens, what the server knows and
// answers, and what the person did to get there. A sheet is one screen with all its states.
import type { Answer } from './server.ts';
import type { World } from './state.ts';
import type { Step } from './steps.ts';

export interface Scenario {
  /** Unique within its sheet, e.g. `locked`; the board is `<Sheet><Id>`. */
  id: string;
  /** The board's title on the canvas (Arabic). */
  title: string;
  /** The address the app opens at, e.g. `/sign-in?reason=idle`. */
  path: string;
  /** Changes to the world before the app starts. */
  world?: (world: World) => void;
  /** Answers of routes that differ from the server's own (`METHOD /path/:id`). */
  answers?: Record<string, Answer>;
  /** What the person did, run once the page shows. */
  steps?: Step[];
  /** Kept on this device before the app starts (the remembered phone). */
  storage?: Record<string, string>;
  /** A dialog or drawer over the page: the board is one window high, as a person sees it. */
  overlay?: boolean;
  /** Every state is on both boards of its sheet; `only` keeps one off the desktop (a phone menu). */
  phone?: 'only';
  latencyMs?: number;
  /** A copy that works or is refused in this state, whatever the frame allows (isolate.ts). */
  clipboard?: 'copied' | 'refused';
  /**
   * A bug of the screen itself, reported to the owner, that makes this state wider than a phone:
   * the check names it on every run but does not fail (the screen changes only from an approved
   * drawing, ADR-0040).
   */
  widerOnPhone?: string;
}

export interface Sheet {
  /** PascalCase, the boards' file prefix, e.g. `SignIn`. */
  id: string;
  /** The screen's name on the canvas (Arabic) and its route. */
  title: string;
  route: string;
  /** What the sheet shows, for the canvas note (English, like the repository). */
  note: string;
  /** The files of the screen in packages/web-shell/src. */
  code: string[];
  scenarios: Scenario[];
  /** Error codes the sheet's code names but no state can show, each with the reason (coverage.ts). */
  unshown?: Record<string, string>;
}

export type { Answer, Step, World };

/** The header bug every state with the recovery-codes badge shows on a phone (reported). */
export const CODES_BADGE_BUG =
  'The header has no room for the recovery-codes badge on a phone: the avatar is pushed out of the window and the page scrolls sideways (src/account/app-frame.tsx); reported to the owner, not fixed here.';
