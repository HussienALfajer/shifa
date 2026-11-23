// Spec 0.4 criterion 6 and ADR-0039: UI SDK is pinned to one exact version, only packages/ui
// depends on it, and the agent bridge is never imported. Licences are recorded per dependency.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { isAgentBridge } from '@shifa/eslint-config/rules/ui-sdk-imports';
import { describe, expect, it } from 'vitest';

const pkgDir = join(import.meta.dirname, '..');
const root = join(pkgDir, '..', '..');

interface Manifest {
  name?: string;
  license?: string;
  version?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
}

const readJson = (path: string): unknown => JSON.parse(readFileSync(path, 'utf8'));
const readManifest = (path: string) => readJson(path) as Manifest;
const manifest = readManifest(join(pkgDir, 'package.json'));
const installed = (name: string) =>
  readManifest(join(pkgDir, 'node_modules', ...name.split('/'), 'package.json'));

/** An exact semver version: no range, tag, alias or URL. */
const EXACT = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.]+)?$/;
const UI_LIBRARY = /^@(?:ui-sdk|base-ui|base-ui-components)\//;

const listFiles = (dir: string): string[] =>
  existsSync(dir)
    ? readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
        e.isDirectory() ? listFiles(join(dir, e.name)) : [join(dir, e.name)],
      )
    : [];

describe('@ui-sdk pin', () => {
  const deps = manifest.dependencies ?? {};

  it('pins @ui-sdk/react and @ui-sdk/core to one exact, equal version', () => {
    const react = deps['@ui-sdk/react'];
    const core = deps['@ui-sdk/core'];
    expect(react).toMatch(EXACT);
    expect(core).toBe(react);
  });

  it('has the pinned version installed', () => {
    expect(installed('@ui-sdk/react').version).toBe(deps['@ui-sdk/react']);
    expect(installed('@ui-sdk/core').version).toBe(deps['@ui-sdk/core']);
  });

  it('pins every dependency exactly; workspace packages by workspace:*', () => {
    const all = { ...manifest.dependencies, ...manifest.devDependencies };
    const loose = Object.entries(all).filter(
      ([name, version]) =>
        !EXACT.test(version) && !(name.startsWith('@shifa/') && version === 'workspace:*'),
    );
    expect(loose).toEqual([]);
    expect(manifest.peerDependencies ?? {}).toEqual({});
  });
});

describe('only packages/ui depends on the UI library', () => {
  it('no other workspace package lists @ui-sdk/* or Base UI', () => {
    const manifests = ['apps', 'packages', 'tooling', 'spikes']
      .flatMap((dir) => listFiles(join(root, dir)))
      .filter((p) => p.endsWith('package.json') && !p.includes('node_modules'))
      .filter((p) => relative(root, p).replaceAll('\\', '/') !== 'packages/ui/package.json');
    expect(manifests.length).toBeGreaterThan(5);
    const offenders = manifests.flatMap((path) => {
      const m = readManifest(path);
      const names = Object.keys({ ...m.dependencies, ...m.devDependencies, ...m.peerDependencies });
      return names.filter((n) => UI_LIBRARY.test(n)).map((n) => `${relative(root, path)}: ${n}`);
    });
    expect(offenders).toEqual([]);
  });
});

describe('the agent bridge', () => {
  it('is named by no file of packages/ui, so lint cannot be silenced around it', () => {
    const files = ['src', 'test', '.storybook', 'scripts']
      .flatMap((dir) => listFiles(join(pkgDir, dir)))
      .filter((p) => /\.(?:[cm]?[jt]sx?|json|css|html)$/.test(p));
    expect(files.length).toBeGreaterThan(0);
    const named = files.filter((path) => {
      const text = readFileSync(path, 'utf8');
      // This file names the pattern, not a specifier.
      if (path === import.meta.filename) return false;
      return [...text.matchAll(/['"`](@ui-sdk\/[^'"`\s]+)['"`]/g)].some((m) =>
        isAgentBridge(m[1] ?? ''),
      );
    });
    expect(named.map((p) => relative(pkgDir, p))).toEqual([]);
  });
});

/**
 * Development packages whose content ships inside ours: the Solar drawings are copied into
 * src/icons and the Flutter painters, so their licence is recorded with the runtime ones.
 */
const VENDORED = ['@iconify-json/solar'];

describe('licences', () => {
  const licences = readJson(join(pkgDir, 'dependency-licences.json')) as Record<string, string>;

  it('records the licence of every runtime dependency as its package declares it', () => {
    const runtime = Object.keys(manifest.dependencies ?? {}).filter(
      (n) => !n.startsWith('@shifa/'),
    );
    expect(Object.keys(licences).sort()).toEqual([...runtime, ...VENDORED].sort());
    for (const name of [...runtime, ...VENDORED]) {
      expect(licences[name], name).toBe(installed(name).license);
    }
  });

  it('holds the vendored Solar icons under CC BY 4.0 (C-7, slice 0.4-12)', () => {
    expect(licences['@iconify-json/solar']).toBe('CC-BY-4.0');
  });

  it('holds UI SDK under Apache-2.0', () => {
    expect(licences['@ui-sdk/react']).toBe('Apache-2.0');
    expect(licences['@ui-sdk/core']).toBe('Apache-2.0');
  });

  it('holds the data table libraries under MIT, exactly pinned (ADR-0039, slice 0.4-07)', () => {
    for (const name of ['@tanstack/react-table', '@tanstack/react-virtual']) {
      expect(licences[name], name).toBe('MIT');
      expect(manifest.dependencies?.[name], name).toMatch(/^\d+\.\d+\.\d+$/);
    }
  });
});
