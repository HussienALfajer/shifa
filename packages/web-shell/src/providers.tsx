// What every page of both apps sits in (slice A-01-06): the query cache, the translator, Arabic
// right to left, the chosen theme, the density, and the shell's own context (which app, the client).
import type { I18n } from '@shifa/i18n/runtime';
import { DensityProvider, DirectionProvider, ThemeProvider } from '@shifa/ui';
import { type QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createContext, type ReactNode, useContext } from 'react';
import { I18nextProvider } from 'react-i18next';
import type { ShellClient } from './client.ts';
import type { ShellApp } from './guard.ts';
import { useThemePreference } from './theme.ts';

export interface ShellContextValue {
  app: ShellApp;
  shell: ShellClient;
  /** The build's version, shown on /about. */
  version: string;
}

const ShellContext = createContext<ShellContextValue | null>(null);

export function useShell(): ShellContextValue {
  const value = useContext(ShellContext);
  if (!value) throw new Error('useShell() outside ShellProviders');
  return value;
}

function Themed({ children }: { children: ReactNode }) {
  const { theme } = useThemePreference();
  return (
    <ThemeProvider theme={theme}>
      <div className="min-h-dvh bg-bg-app text-text-default">{children}</div>
    </ThemeProvider>
  );
}

export function ShellProviders({
  value,
  queryClient,
  i18n,
  children,
}: {
  value: ShellContextValue;
  queryClient: QueryClient;
  i18n: I18n;
  children: ReactNode;
}) {
  return (
    <ShellContext value={value}>
      <QueryClientProvider client={queryClient}>
        <I18nextProvider i18n={i18n}>
          <DirectionProvider dir="rtl" lang="ar">
            <Themed>
              <DensityProvider density="comfortable">{children}</DensityProvider>
            </Themed>
          </DirectionProvider>
        </I18nextProvider>
      </QueryClientProvider>
    </ShellContext>
  );
}
