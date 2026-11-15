// Entry point: picks the engine from the build flag (VITE_ENGINE), registers the app-shell
// service worker. With PowerSync the service URL comes from `?ps=` once and is remembered.
import type { SyncEngine } from './engine.ts';
import { createOutboxEngine } from './outbox/index.ts';
import { mountApp } from './ui/app.ts';

function powerSyncEndpoint(): string {
  const fromUrl = new URL(location.href).searchParams.get('ps');
  if (fromUrl) localStorage.setItem('s1-ps-endpoint', fromUrl);
  return (
    fromUrl ??
    localStorage.getItem('s1-ps-endpoint') ??
    `${location.protocol}//${location.hostname}:8080`
  );
}

async function createEngine(): Promise<SyncEngine> {
  const baseUrl = location.origin;
  // Direct comparisons with the build constant, so each build drops the other engines' code.
  if (import.meta.env.VITE_ENGINE === 'powersync') {
    const { createPowerSyncEngine } = await import('./powersync/index.ts');
    return createPowerSyncEngine({ baseUrl, endpoint: powerSyncEndpoint() });
  }
  if (import.meta.env.VITE_ENGINE === 'stub-drop') {
    return (await import('./stubs.ts')).createDroppingEngine(baseUrl);
  }
  if (import.meta.env.VITE_ENGINE === 'stub-dup') {
    return (await import('./stubs.ts')).createDuplicatingEngine(baseUrl);
  }
  return createOutboxEngine({ baseUrl });
}

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  void navigator.serviceWorker.register('/sw.js');
}

const root = document.getElementById('app');
if (root) mountApp(root, await createEngine());
