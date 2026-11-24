// Slice A-01-06 (audit 0.4, P-N2): clinic web builds for production with the `production` export
// condition, so UI SDK's development history (devtools hook, global state) never ships; and the
// service worker it builds precaches the shell and nothing under /api.

import { buildForCheck, devHistoryMarkers } from '@shifa/web-shell/vite';
import { describe, expect, it } from 'vitest';

const APP_DIR = new URL('..', import.meta.url);

describe('clinic web production build', () => {
  it('finds a planted development-history marker', () => {
    expect(devHistoryMarkers('var a = 1;')).toEqual([]);
    expect(devHistoryMarkers('window.__UI_SDK__ = {};')).toEqual(['__UI_SDK__']);
    expect(devHistoryMarkers('emit("ui-sdk.devtools", x)')).toEqual(['ui-sdk.devtools']);
  });

  it('carries no UI SDK development history and a shell-only service worker', async () => {
    const built = await buildForCheck(APP_DIR);
    try {
      expect(built.scripts.length).toBeGreaterThan(0);
      for (const [file, text] of built.scripts) expect(devHistoryMarkers(text), file).toEqual([]);
      expect(built.serviceWorker).toContain('/index.html');
      expect(built.serviceWorker).not.toContain('/api/');
      expect(built.indexHtml).toMatch(/<html[^>]*lang="ar"[^>]*dir="rtl"/);
    } finally {
      await built.remove();
    }
  }, 180_000);
});
