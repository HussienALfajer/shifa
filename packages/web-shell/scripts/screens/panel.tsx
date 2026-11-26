// A board of the screens canvas with its state panel (ADR-0049): clinic web in a window of its own
// at the board's real width (1440 or 390), and at its right a panel built from Shifa's own
// components (Select, SegmentedControl, Button) that restarts the app at any state and theme.
// The panel starts from the board's Tweaks (the saved, shared values) and keeps its choice in its
// own state: the viewer's only, gone on reload; «Reset» goes back to Tweaks.
//
// The app runs in an inner frame, not beside the panel in the board's document: its layout reads
// the window (media queries, `matchMedia`, `100dvh`, dialogs fixed to the viewport), so it needs
// a window exactly as wide as the device while the board itself is wider to hold the panel. The
// frame loads this same bundle and calls its `mount()`; each state starts there as before.
import {
  Button,
  DensityProvider,
  DirectionProvider,
  Radio,
  RadioGroup,
  SegmentedControl,
  ThemeProvider,
} from '@shifa/ui';
import { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { type Device, PANEL_GAP, PANEL_WIDTH, statesOn, WINDOW } from './boards.ts';
import type { BoardOptions } from './entry.tsx';
import { SHEETS } from './scenarios/index.ts';
import { PLAY_CODE, PLAY_PASSWORD } from './state.ts';

export type Theme = 'light' | 'dark';

export interface BoardProps {
  sheet: string;
  /** The window's width and height: the device's width, the board's tallest state. */
  width: number;
  height: number;
  /** The Tweaks values. */
  state: string;
  theme: Theme;
}

type Mount = (element: HTMLElement, options: BoardOptions) => () => void;
interface Inner {
  ShifaScreens?: { mount: Mount };
}

/** Where this bundle was loaded from, for the inner window (an inline script has no `src`). */
const script =
  [
    (document.currentScript as HTMLScriptElement | null)?.src,
    document.querySelector<HTMLScriptElement>('script[src*="screens.js"]')?.src,
  ].find(Boolean) ?? '';

const MARKER = '--shifa-screens-bundle';
let copied: string | undefined;

/**
 * This bundle's stylesheet for the inner window, as the board's own document has it: the canvas
 * may serve it inlined or at an address no longer named `screens.css` (seen on the live canvas,
 * where the frame came out unstyled). A sheet is known by its marker rule (styles.css); a sheet of
 * another origin, whose rules cannot be read, by its address.
 */
function stylesheet(): { text: string } | { href: string } {
  if (copied !== undefined) return { text: copied };
  for (const sheet of document.styleSheets) {
    let rules: CSSRuleList | undefined;
    try {
      rules = sheet.cssRules;
    } catch {
      if (sheet.href?.includes('screens')) return { href: sheet.href };
      continue;
    }
    const text = Array.from(rules, (rule) => rule.cssText).join('\n');
    if (text.includes(MARKER)) {
      copied = text;
      return { text };
    }
  }
  return { href: script.replace(/\.js(\?.*)?$/, '.css') };
}

/** Puts the stylesheet into the inner window before the app mounts. */
function styleInner(doc: Document) {
  const css = stylesheet();
  const node =
    'text' in css ? doc.createElement('style') : Object.assign(doc.createElement('link'), css);
  if ('text' in css) node.textContent = css.text;
  else (node as HTMLLinkElement).rel = 'stylesheet';
  doc.head.append(node);
}

/** The panel's rows besides the state list (heading, theme, restart, notes), and the list's least. */
const PANEL_CHROME = 380;
const MIN_LIST = 420;
const MUTED = { color: 'var(--shifa-color-text-muted)' } as const;
const LABEL = { ...MUTED, fontSize: 'var(--shifa-font-size-200)', fontWeight: 500 } as const;
const NOTE = {
  ...MUTED,
  margin: 0,
  fontSize: 'var(--shifa-font-size-100)',
  lineHeight: 'var(--shifa-text-leading-body)',
} as const;

function Panel(props: {
  sheet: string;
  state: string;
  theme: Theme;
  onState: (state: string) => void;
  onTheme: (theme: Theme) => void;
  onRestart: () => void;
  onReset: () => void;
  device: Device;
  /** The state list's height: the board's, less the panel's other rows. */
  listHeight: number;
}) {
  const sheet = SHEETS.find((s) => s.id === props.sheet);
  // As the board's Tweaks: a phone-only state (the phone's menu) is not offered on a desktop.
  const states = sheet ? statesOn(sheet, props.device) : [];
  const scenario = states.find((s) => s.id === props.state);
  return (
    <aside
      data-panel
      data-density="compact"
      dir="ltr"
      lang="en"
      style={{
        boxSizing: 'border-box',
        width: PANEL_WIDTH,
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--shifa-space-4)',
        padding: 'var(--shifa-space-5)',
        borderRadius: 'var(--shifa-radius-lg)',
        background: 'var(--shifa-color-bg-surface)',
        border: '1px solid var(--shifa-color-border-default)',
        color: 'var(--shifa-color-text-default)',
        fontFamily: 'var(--shifa-text-family-ui)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 'var(--shifa-space-2)',
        }}
      >
        <strong style={{ fontSize: 'var(--shifa-font-size-300)', fontWeight: 600 }}>
          This board
        </strong>
        <Button variant="ghost" size="sm" onClick={props.onReset}>
          Reset
        </Button>
      </div>
      {/* Every state at once, one press away: a sheet has up to some eighty, more than a
          dropdown holds in a board one window high; the list scrolls inside the panel. */}
      <div dir="rtl" lang="ar" style={{ maxHeight: props.listHeight, overflowY: 'auto' }}>
        <RadioGroup
          label="الحالة"
          value={props.state}
          onValueChange={(value) => {
            props.onState(value);
          }}
        >
          {states.map((s) => (
            <Radio key={s.id} value={s.id}>
              {s.title}
            </Radio>
          ))}
        </RadioGroup>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--shifa-space-2)' }}>
        <span style={LABEL}>Theme</span>
        <SegmentedControl
          aria-label="Theme"
          items={[
            { value: 'light', label: 'Light' },
            { value: 'dark', label: 'Dark' },
          ]}
          value={props.theme}
          onValueChange={(value) => {
            props.onTheme(value === 'dark' ? 'dark' : 'light');
          }}
        />
      </div>
      <Button size="sm" onClick={props.onRestart}>
        Restart this state
      </Button>
      {scenario ? (
        <p style={NOTE}>
          Opens at <code dir="ltr">{scenario.path}</code>
          {scenario.steps?.length
            ? `, then ${String(scenario.steps.length)} steps by the person`
            : ''}
          .
        </p>
      ) : null}
      <p style={NOTE}>
        Starts from Tweaks. What you choose here is yours only and goes on reload. In Play: password{' '}
        {PLAY_PASSWORD}, code {PLAY_CODE}.
      </p>
    </aside>
  );
}

/** The board: the app's window, then the panel; restarts the app whenever the choice changes. */
function BoardView({ sheet, width, height, state: tweakState, theme: tweakTheme }: BoardProps) {
  const [mine, setMine] = useState<{ state?: string; theme?: Theme }>({});
  const [run, setRun] = useState(0);
  const [ready, setReady] = useState(false);
  const frame = useRef<HTMLIFrameElement | null>(null);
  // A change of Tweaks is a new starting point: the viewer's own choice gives way to it.
  useEffect(() => {
    setMine({});
  }, [tweakState, tweakTheme]);
  const state = mine.state ?? tweakState;
  const theme = mine.theme ?? tweakTheme;
  useEffect(() => {
    const win = frame.current?.contentWindow as (Window & Inner) | null | undefined;
    const host = frame.current?.contentDocument?.getElementById('app');
    if (!ready || !win?.ShifaScreens || !host) return undefined;
    const done = win.ShifaScreens.mount(host, { sheet, state, theme });
    return done;
  }, [ready, sheet, state, theme, run]);
  const doc = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><style>html,body{margin:0}</style><script src="${script}"></script></head><body><div id="app"></div></body></html>`;
  return (
    <DirectionProvider dir="ltr" lang="en">
      <ThemeProvider theme={theme}>
        <DensityProvider density="compact">
          <div
            data-board
            dir="ltr"
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: PANEL_GAP,
              width: width + PANEL_GAP + PANEL_WIDTH,
              minHeight: height,
              background: 'var(--shifa-color-bg-app)',
            }}
          >
            <iframe
              ref={frame}
              title="clinic web"
              srcDoc={doc}
              onLoad={() => {
                const inner = frame.current?.contentDocument;
                if (inner) styleInner(inner);
                setReady(true);
              }}
              style={{ display: 'block', border: 0, width, height, flex: 'none' }}
            />
            <Panel
              device={width === WINDOW.phone.width ? 'phone' : 'desktop'}
              listHeight={Math.max(height - PANEL_CHROME, MIN_LIST)}
              sheet={sheet}
              state={state}
              theme={theme}
              onState={(next) => {
                setMine((m) => ({ ...m, state: next }));
              }}
              onTheme={(next) => {
                setMine((m) => ({ ...m, theme: next }));
              }}
              onRestart={() => {
                setRun((n) => n + 1);
              }}
              onReset={() => {
                setMine({});
                setRun((n) => n + 1);
              }}
            />
          </div>
        </DensityProvider>
      </ThemeProvider>
    </DirectionProvider>
  );
}

/** Renders a board in `element` with this bundle's React; returns an update and the unmount. */
export function mountBoard(element: HTMLElement, props: BoardProps) {
  // A container of its own: an earlier board in the same element may still be unmounting.
  const container = document.createElement('div');
  element.replaceChildren(container);
  const root = createRoot(container);
  root.render(<BoardView {...props} />);
  return {
    update: (next: BoardProps) => {
      root.render(<BoardView {...next} />);
    },
    unmount: () => {
      root.unmount();
      container.remove();
    },
  };
}

interface HostReact {
  createElement: (type: string, props: object) => unknown;
  useRef: <T>(value: T) => { current: T };
  useLayoutEffect: (effect: () => undefined | (() => void), deps?: unknown[]) => void;
}

/** The island of the canvas's own React: a block, the board rendered inside with this bundle's. */
export function Board(
  props: Partial<Omit<BoardProps, 'width' | 'height'>> & {
    sheet: string;
    width?: number | string;
    height?: number | string;
  },
) {
  const host = (globalThis as unknown as { React: HostReact }).React;
  const element = host.useRef<HTMLDivElement | null>(null);
  const board = host.useRef<ReturnType<typeof mountBoard> | null>(null);
  const full: BoardProps = {
    sheet: props.sheet,
    // Attributes of the canvas's markup arrive as strings.
    width: Number(props.width ?? WINDOW.desktop.width),
    height: Number(props.height ?? WINDOW.desktop.height),
    state: props.state ?? '',
    theme: props.theme === 'dark' ? 'dark' : 'light',
  };
  host.useLayoutEffect(() => {
    if (!element.current) return undefined;
    board.current = mountBoard(element.current, full);
    return () => {
      const mounted = board.current;
      board.current = null;
      // React may not unmount a root while rendering: the board ends just after.
      queueMicrotask(() => mounted?.unmount());
    };
  }, []);
  host.useLayoutEffect(() => {
    board.current?.update(full);
    return undefined;
  }, [full.sheet, full.width, full.height, full.state, full.theme]);
  return host.createElement('div', { ref: element });
}
Board.displayName = 'ShifaScreens.Board';
