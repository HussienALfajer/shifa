// Slice A-01-06: each app and its /api share one origin (the request guard admits same-origin
// writes only, A-01-02). The dev and preview servers proxy /api/* to the API with the prefix
// removed, and nothing else: /apix or /x/api stay with the app.
import { describe, expect, it } from 'vitest';
import { apiProxy, shellViteConfig } from '../src/vite/index.ts';

describe('the /api proxy', () => {
  const [[key, rule]] = Object.entries(apiProxy('http://127.0.0.1:4100')) as [
    [string, { target: string; rewrite: (path: string) => string; changeOrigin: boolean }],
  ];
  const matches = (path: string) => new RegExp(key).test(path);

  it('matches /api and /api/* only', () => {
    expect(matches('/api')).toBe(true);
    expect(matches('/api/auth/session')).toBe(true);
    expect(matches('/api?x=1')).toBe(true);
    expect(matches('/apix')).toBe(false);
    expect(matches('/x/api/auth')).toBe(false);
    expect(matches('/')).toBe(false);
  });

  it('removes the prefix once and keeps the rest', () => {
    expect(rule.target).toBe('http://127.0.0.1:4100');
    expect(rule.rewrite('/api/auth/session')).toBe('/auth/session');
    expect(rule.rewrite('/api/api/x')).toBe('/api/x');
    expect(rule.rewrite('/api')).toBe('/');
    expect(rule.rewrite('/api?x=1')).toBe('/?x=1');
  });

  it('is the same rule on the dev and the preview server, on the app port', () => {
    const config = shellViteConfig({ port: 5173, apiUrl: 'http://127.0.0.1:4100' });
    expect(config.server?.port).toBe(5173);
    expect(config.server?.strictPort).toBe(true);
    expect(config.preview?.port).toBe(5173);
    expect(Object.keys(config.server?.proxy ?? {})).toEqual([key]);
    expect(Object.keys(config.preview?.proxy ?? {})).toEqual([key]);
  });
});
