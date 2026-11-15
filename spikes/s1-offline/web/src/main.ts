// Entry point: creates the sync engine, registers the app-shell service worker.
import type { SyncEngine } from './engine.ts';
import { createOutboxEngine } from './outbox/index.ts';
import { mountApp } from './ui/app.ts';

function createEngine(): Promise<SyncEngine> | SyncEngine {
  return createOutboxEngine({ baseUrl: location.origin });
}

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  void navigator.serviceWorker.register('/sw.js');
}

const root = document.getElementById('app');
if (root) mountApp(root, await createEngine());
