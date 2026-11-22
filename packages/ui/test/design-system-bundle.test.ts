// Spec 0.4 criterion 12 (slice 0.4-03): the components of packages/ui go to the Shifa Design
// System as ONE classic script (global `Shifa`, React 19 inside, no import, no network call),
// its stylesheet, types, and a preview and guidelines per public component. No agent-bridge code.
import { mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createContext, runInContext } from 'node:vm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildBundle } from '../scripts/design-system/bundle.ts';
import { PARTS, PROVIDED } from '../scripts/design-system/compound.tsx';
import * as ui from '../src/index.ts';

let out: string;
const read = (path: string) => readFileSync(join(out, path), 'utf8');

beforeAll(async () => {
  out = mkdtempSync(join(tmpdir(), 'shifa-bundle-'));
  await buildBundle(out);
}, 120_000);
afterAll(() => {
  rmSync(out, { recursive: true, force: true });
});

/** PascalCase function exports that are not providers. */
const EXPORTED = Object.entries(ui)
  .filter(([name, value]) => /^[A-Z]/.test(name) && typeof value === 'function')
  .map(([name]) => name)
  .filter((name) => !name.endsWith('Provider'));
/**
 * The public components: the exports that are not a part of a composed component (Tab…), and the
 * cards that stand for a provider (Toast for ToastProvider).
 */
const PUBLIC = [...EXPORTED.filter((name) => !(name in PARTS)), ...Object.keys(PROVIDED)].sort();

describe('design-system bundle', () => {
  it('names a real provider export for each provider card', () => {
    for (const [card, provider] of Object.entries(PROVIDED)) {
      expect(typeof (ui as Record<string, unknown>)[provider], card).toBe('function');
    }
  });

  it('lists only real exports as parts, each of a public component', () => {
    for (const [part, family] of Object.entries(PARTS)) {
      expect(EXPORTED, part).toContain(part);
      expect(PUBLIC, part).toContain(family);
    }
  });

  it('is one classic script with the @ds-bundle header naming every public component', () => {
    const js = read('components/bundle.js');
    const header = /^\/\* @ds-bundle: (\{.*\}) \*\/\n/.exec(js);
    expect(header, 'line 1 is the @ds-bundle header').not.toBeNull();
    const meta = JSON.parse(header?.[1] ?? '{}') as {
      format: number;
      namespace: string;
      components: { name: string }[];
    };
    expect(meta.format).toBe(4);
    expect(meta.namespace).toBe('Shifa');
    expect(meta.components.map((c) => c.name).sort()).toEqual(PUBLIC);
    expect(PUBLIC).toContain('Button');
    expect(statSync(join(out, 'components', 'bundle.js')).size).toBeLessThan(6 * 1024 * 1024);
  });

  it('has no module syntax, no network call, nothing that ends an inline script', () => {
    const js = read('components/bundle.js');
    expect(js).not.toMatch(/^\s*(?:import|export)\s/m);
    expect(js).not.toMatch(/\bimport\s*\(/);
    for (const forbidden of [
      'fetch(',
      'XMLHttpRequest',
      'WebSocket',
      'sendBeacon',
      'EventSource',
    ]) {
      expect(js.includes(forbidden), forbidden).toBe(false);
    }
    expect(js).not.toMatch(/<\/script/i);
    expect(js).not.toContain('<!--');
  });

  it('carries no agent-bridge code', () => {
    const js = read('components/bundle.js');
    for (const forbidden of [
      'createAgent',
      'registerTools',
      // Built from parts: test/dependencies.test.ts refuses the specifier written out in packages/ui.
      ['@ui-sdk', 'react', 'agent'].join('/'),
      'modelContext',
    ]) {
      expect(js.includes(forbidden), forbidden).toBe(false);
    }
  });

  it('runs as a classic script and sets window.Shifa with mount and every component', () => {
    const window: Record<string, unknown> = {};
    const context = createContext({ window, self: window, globalThis: window, console });
    runInContext(read('components/bundle.js'), context);
    const shifa = window['Shifa'] as Record<string, unknown> | undefined;
    expect(shifa).toBeDefined();
    expect(typeof shifa?.['mount']).toBe('function');
    for (const name of PUBLIC) expect(typeof shifa?.[name], name).toBe('function');
    expect(window['React'], 'React stays inside the bundle').toBeUndefined();
  });

  it('ships the stylesheet: component utilities and the compact density, no page reset', () => {
    const css = read('components/bundle.css');
    expect(css).toContain('--shifa-button-primary-bg');
    expect(css).toMatch(/\[data-density=['"]compact['"]\]/);
    expect(css).not.toMatch(/\*,\s*::after,\s*::before/);
    // Markers of Tailwind's preflight that survive minification (the selector above does not).
    expect(css).not.toMatch(/box-sizing:\s*border-box/);
    expect(css).not.toContain('-webkit-text-size-adjust');
    expect(css).not.toMatch(/html,\s*:host/);
    expect(css).not.toMatch(/<\/style/i);
  });

  it('gives every public component a preview and guidelines, and types', () => {
    for (const name of PUBLIC) {
      const preview = read(`components/${name}/preview.html`);
      expect(preview.split('\n')[0], name).toMatch(/^<!-- @dsCard group="[^"]+" height=\d+/);
      expect(preview, name).toContain(`Shifa.mount(`);
      expect(preview, name).not.toMatch(/<script[^>]*\bsrc=/);
      // bundle.css carries no page reset, so each preview document sizes its own boxes: without
      // this, a full-width field adds its padding and border to its column and overlaps the next.
      expect(preview, name).toContain('*, *::before, *::after { box-sizing: border-box; }');
      const guide = read(`components/${name}/README.md`);
      expect(guide.trim().length, name).toBeGreaterThan(100);
    }
    expect(read('components/index.d.ts')).toContain('ButtonProps');
  });
});
