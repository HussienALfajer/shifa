// Starts an app (slice A-01-06): client, cache, translator, router and providers, the focus
// watch, and in production the shell's service worker. Each app's main.tsx calls this once.
import { createI18n } from '@shifa/i18n/runtime';
import { QueryClient } from '@tanstack/react-query';
import { RouterProvider } from '@tanstack/react-router';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createShellClient } from './client.ts';
import type { ShellApp } from './guard.ts';
import { shellPages } from './pages.tsx';
import { ShellProviders } from './providers.tsx';
import { createShellRouter, type ShellPages } from './router.tsx';
import { watchFocus } from './session.ts';

export interface MountOptions {
  app: ShellApp;
  element: HTMLElement;
  version: string;
  pages?: ShellPages;
  /** Production builds register /sw.js (app shell only, ADR-0010). */
  serviceWorker: boolean;
}

export function mountShellApp({ app, element, version, pages, serviceWorker }: MountOptions) {
  const shell = createShellClient();
  const queryClient = new QueryClient();
  const { router } = createShellRouter({
    app,
    shell,
    queryClient,
    pages: pages ?? shellPages,
  });
  watchFocus(queryClient);
  if (serviceWorker && 'serviceWorker' in navigator) {
    void navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => undefined);
  }
  createRoot(element).render(
    <StrictMode>
      <ShellProviders value={{ app, shell, version }} queryClient={queryClient} i18n={createI18n()}>
        <RouterProvider router={router} />
      </ShellProviders>
    </StrictMode>,
  );
}
