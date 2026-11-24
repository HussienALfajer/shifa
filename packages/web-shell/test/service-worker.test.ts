// Slice A-01-06 (ADR-0010): the service worker keeps the app shell only. It precaches the build's
// files, answers navigations with index.html when the network fails, and never answers /api/* or
// anything it did not precache (no runtime caching; offline data is A-05).
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';
import { precacheList, serviceWorkerSource } from '../src/vite/service-worker.ts';

interface FakeEvent {
  request: { url: string; method: string; mode: string };
  answered: boolean;
  respondWith: (response: unknown) => void;
}

/** Runs the worker source in a sandbox and returns its fetch listener. */
function load(files: string[]) {
  const listeners = new Map<string, (event: unknown) => void>();
  const self = {
    location: { origin: 'https://clinic.test' },
    addEventListener: (type: string, listener: (event: unknown) => void) =>
      listeners.set(type, listener),
    skipWaiting: () => Promise.resolve(),
    clients: { claim: () => Promise.resolve() },
  };
  runInNewContext(serviceWorkerSource(files, 'v1'), {
    self,
    caches: {},
    fetch: () => Promise.reject(new Error('offline')),
    URL,
    Promise,
  });
  const fetchListener = listeners.get('fetch');
  if (!fetchListener) throw new Error('no fetch listener');
  return (url: string, mode = 'no-cors', method = 'GET') => {
    const event: FakeEvent = {
      request: { url, method, mode },
      answered: false,
      respondWith: () => {
        event.answered = true;
      },
    };
    fetchListener(event);
    return event.answered;
  };
}

describe('service worker', () => {
  const files = ['index.html', 'assets/index-abc.js', 'assets/index-abc.css'];

  it('precaches the build files, never sw.js itself or anything under api/', () => {
    expect(precacheList(['sw.js', 'api/x.json', ...files, 'assets/x.map'])).toEqual(
      ['/assets/index-abc.css', '/assets/index-abc.js', '/index.html'].sort(),
    );
  });

  it('answers navigations and precached files', () => {
    const handles = load(files);
    expect(handles('https://clinic.test/', 'navigate')).toBe(true);
    expect(handles('https://clinic.test/team/members', 'navigate')).toBe(true);
    expect(handles('https://clinic.test/assets/index-abc.js')).toBe(true);
  });

  it('never answers /api, another origin, a write, or a file it did not precache', () => {
    const handles = load(files);
    expect(handles('https://clinic.test/api/auth/session')).toBe(false);
    expect(handles('https://clinic.test/api/auth/session', 'navigate')).toBe(false);
    expect(handles('https://clinic.test/api', 'navigate')).toBe(false);
    expect(handles('https://clinic.test/api/auth/sign-in', 'cors', 'POST')).toBe(false);
    expect(handles('https://clinic.test/assets/other.js')).toBe(false);
    expect(handles('https://cdn.test/assets/index-abc.js')).toBe(false);
  });

  it('has no runtime caching: the only cache.put is in install', () => {
    const source = serviceWorkerSource(files, 'v1');
    expect(source.match(/\.put\(/g) ?? []).toHaveLength(0);
    expect(source).not.toContain('/api/');
  });
});
