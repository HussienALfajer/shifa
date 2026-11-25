// The entry of the screens bundle (build.ts makes it one classic script, React 19 inside, global
// `ShifaScreens`): clinic web itself, the shell's own providers, router and pages, on a memory
// history and the board's fake server, in the theme the board names. Nothing is redrawn here:
// what a board shows is what the app renders for that address, that server and those steps.
// - `ShifaScreens.mount(element, { sheet, state, theme })` starts the app in an element;
// - `ShifaScreens.Board` is the board's island for the canvas's own React (attributes sheet, width,
//   height, state, theme): the app in a window of the device's width and the state panel (panel.tsx);
//   `ShifaScreens.mountBoard` renders the same board without the canvas (the check).
import './isolate.ts';
import { createI18n } from '@shifa/i18n/runtime';
import { QueryClient } from '@tanstack/react-query';
import { createMemoryHistory, RouterProvider } from '@tanstack/react-router';
import { StrictMode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { createShellClient } from '../../src/client.ts';
import { shellPages } from '../../src/pages.tsx';
import { ShellProviders } from '../../src/providers.tsx';
import { createShellRouter } from '../../src/router.tsx';
import { THEME_STORAGE_KEY } from '../../src/theme.ts';
import { boardStorage, resetClock } from './isolate.ts';
import { Board, mountBoard } from './panel.tsx';
import { SHEETS } from './scenarios/index.ts';
import { answered, createServer } from './server.ts';
import { createWorld } from './state.ts';
import { runSteps, type Translate } from './steps.ts';
import './styles.css';

export interface BoardOptions {
  sheet: string;
  state: string;
  theme?: 'light' | 'dark';
}

/** The state chosen; an unknown one (a renamed state in an old tweak) opens the sheet's first. */
function scenarioOf(sheet: string, state: string) {
  const states = SHEETS.find((s) => s.id === sheet)?.scenarios ?? [];
  const found = states.find((s) => s.id === state) ?? states[0];
  if (!found) throw new Error(`screens canvas: no sheet ${sheet}`);
  return found;
}

let runs = 0;

/** Starts clinic web in `element` at the state's address; returns the unmount. */
function mount(element: HTMLElement, { sheet, state, theme = 'light' }: BoardOptions): () => void {
  const scenario = scenarioOf(sheet, state);
  // A state of its own: the previous one's steps stop, its clock and storage are gone.
  const life = new AbortController();
  resetClock();
  answered.clear();
  boardStorage.clear();
  boardStorage.setItem(THEME_STORAGE_KEY, theme);
  for (const [key, value] of Object.entries(scenario.storage ?? {}))
    boardStorage.setItem(key, value);
  const world = createWorld();
  scenario.world?.(world);
  const server = createServer({
    world,
    ...(scenario.answers ? { answers: scenario.answers } : {}),
    ...(scenario.latencyMs === undefined ? {} : { latencyMs: scenario.latencyMs }),
  });
  // The origin is never reached: every request goes to the board's server.
  const shell = createShellClient({ baseUrl: 'https://clinic.example/api', fetch: server.fetch });
  const queryClient = new QueryClient();
  const i18n = createI18n();
  const { router, dispose } = createShellRouter({
    app: 'clinic',
    shell,
    queryClient,
    pages: shellPages,
    history: createMemoryHistory({ initialEntries: [scenario.path] }),
  });
  // Each state in a fresh container of its own: the one before may still be unmounting.
  const container = document.createElement('div');
  container.style.minHeight = '100dvh';
  element.replaceChildren(container);
  const root: Root = createRoot(container);
  root.render(
    <StrictMode>
      <ShellProviders
        value={{ app: 'clinic', shell, version: '0.0.0' }}
        queryClient={queryClient}
        i18n={i18n}
      >
        <RouterProvider router={router} />
      </ShellProviders>
    </StrictMode>,
  );
  const t: Translate = (key, values) => i18n.t(`common:${key}`, values ?? {});
  container.dataset['screen'] = 'starting';
  container.dataset['state'] = scenario.id;
  // Which start of the app this is in its window: the check waits for a restart by it.
  runs += 1;
  container.dataset['run'] = String(runs);
  // The page first loads what it reads, the person acts, then the answers to that arrive.
  void (async () => {
    await server.settled();
    await runSteps(container, scenario.steps ?? [], t, life.signal);
    await server.settled();
  })().then(
    () => {
      container.dataset['screen'] = 'ready';
    },
    (error: unknown) => {
      if (life.signal.aborted) return;
      container.dataset['screen'] = 'failed';
      // Kept on the board for the check to report (a step that found nothing).
      container.dataset['screenError'] = error instanceof Error ? error.message : String(error);
    },
  );
  return () => {
    life.abort();
    root.unmount();
    dispose();
    container.remove();
  };
}

const target = globalThis as unknown as Record<string, unknown>;
target['ShifaScreens'] = {
  sheets: SHEETS.map((s) => ({ id: s.id, states: s.scenarios.map((x) => x.id) })),
  mount,
  /** The error codes the server answered in the current state (the check's coverage). */
  answered: () => [...answered],
  mountBoard,
  Board,
};
