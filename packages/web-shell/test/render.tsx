// Renders the shell for page tests (slice A-01-07): the real providers, translator and router on
// a memory history, the fake API behind the typed client, React's act() around every change.
// happy-dom gives the DOM; geometry and colours are left to the browser screenshots and e2e.
import { createI18n } from '@shifa/i18n/runtime';
import { QueryClient } from '@tanstack/react-query';
import { createMemoryHistory, RouterProvider } from '@tanstack/react-router';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { createShellClient } from '../src/client.ts';
import type { ShellApp } from '../src/guard.ts';
import { shellPages } from '../src/pages.tsx';
import { ShellProviders } from '../src/providers.tsx';
import { createShellRouter } from '../src/router.tsx';
import type { FakeApi } from './support.ts';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

export interface Rendered {
  container: HTMLElement;
  router: ReturnType<typeof createShellRouter>['router'];
  queryClient: QueryClient;
  unmount: () => Promise<void>;
}

/** Lets promises, timers of 0 ms and React's work run. */
export async function flush(ms = 0): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, ms));
  });
}

export async function renderShell(app: ShellApp, api: FakeApi, path: string): Promise<Rendered> {
  const container = document.createElement('div');
  document.body.append(container);
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const shell = createShellClient({ baseUrl: 'http://shell.test/api', fetch: api.fetch });
  const history = createMemoryHistory({ initialEntries: [path] });
  const { router, dispose } = createShellRouter({
    app,
    shell,
    queryClient,
    history,
    pages: shellPages,
  });
  const root = createRoot(container);
  await act(async () => {
    root.render(
      <ShellProviders
        value={{ app, shell, version: 'test' }}
        queryClient={queryClient}
        i18n={createI18n()}
      >
        <RouterProvider router={router} />
      </ShellProviders>,
    );
    await router.load();
  });
  // Under load the first render can take a while: wait for the page, not a fixed time.
  for (let i = 0; i < 100 && !container.querySelector('main'); i += 1) await flush(20);
  return {
    container,
    router,
    queryClient,
    unmount: async () => {
      await act(async () => {
        root.unmount();
        await Promise.resolve();
      });
      dispose();
      container.remove();
    },
  };
}

/** Sets an input's value the way a person typing does, so React sees the change. */
export async function type(input: HTMLInputElement, value: string): Promise<void> {
  // The native setter: React tracks the value it last set and ignores an event without a change.
  const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
  await act(async () => {
    descriptor?.set?.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await Promise.resolve();
  });
}

export async function click(element: Element): Promise<void> {
  await act(async () => {
    (element as HTMLElement).click();
    await Promise.resolve();
  });
  await flush(10);
}

/** The labelled control: the input whose label reads `name`. */
export function field(container: HTMLElement, name: string): HTMLInputElement {
  for (const label of container.querySelectorAll('label')) {
    if (label.textContent.trim() !== name) continue;
    const id = label.htmlFor;
    const input = id ? container.querySelector<HTMLInputElement>(`[id="${id}"]`) : null;
    if (input) return input;
  }
  throw new Error(`no field labelled ${name}`);
}

export function button(container: HTMLElement, name: string): HTMLButtonElement {
  for (const b of container.querySelectorAll('button')) {
    if (b.textContent.trim() === name || b.getAttribute('aria-label') === name) return b;
  }
  throw new Error(`no button ${name}`);
}
