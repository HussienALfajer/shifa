// Spec 0.4 criterion 4: the design directions are stored as static builds, each showing the same
// three screens with synthetic data and no request to the network. Four directions (a-d): the
// owner asked for a fourth on 2026-11-20.
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, it } from 'node:test';

const root = join(import.meta.dirname, '..', '..');
const directionsDir = join(root, 'design', 'directions');

const DIRECTIONS = ['a', 'b', 'c', 'd'];
const SCREENS = ['reception-queue.html', 'doctor-visit.html', 'patient-booking.html'];
const TEXT_FILE = /\.(html|css|js|mjs|json|svg)$/;
/** XML namespaces are identifiers, not requests. */
const NAMESPACE = /^https?:\/\/www\.w3\.org\//;

const listFiles = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? listFiles(join(dir, entry.name)) : [join(dir, entry.name)],
  );

const nameLists = async () => {
  const lists = await import('../../packages/testing/src/synthetic/names/lists.ts');
  return new Set(Object.values(lists).filter(Array.isArray).flat());
};

/** True when the words of `name` can be split into list entries (an entry may be two words). */
const isSynthetic = (name, entries) => {
  const words = name.trim().split(/\s+/);
  const reachable = [true, ...words.map(() => false)];
  for (let end = 1; end <= words.length; end += 1) {
    for (let start = Math.max(0, end - 3); start < end; start += 1) {
      if (reachable[start] && entries.has(words.slice(start, end).join(' '))) {
        reachable[end] = true;
      }
    }
  }
  return reachable[words.length];
};

describe('design directions', () => {
  it('has a README and a brief per direction', () => {
    assert.ok(existsSync(join(directionsDir, 'README.md')), 'design/directions/README.md');
    for (const id of DIRECTIONS) {
      assert.ok(existsSync(join(directionsDir, 'briefs', `${id}.md`)), `briefs/${id}.md`);
    }
  });

  for (const id of DIRECTIONS) {
    describe(`direction ${id}`, () => {
      const dir = join(directionsDir, id);

      it('has the three screens, Arabic and right-to-left', () => {
        for (const screen of SCREENS) {
          const path = join(dir, screen);
          assert.ok(existsSync(path), `${id}/${screen}`);
          const html = readFileSync(path, 'utf8');
          assert.match(html, /<html[^>]*\blang="ar"/, `${id}/${screen}: lang="ar"`);
          assert.match(html, /<html[^>]*\bdir="rtl"/, `${id}/${screen}: dir="rtl"`);
        }
      });

      it('has the theme, density and digit switches', () => {
        const text = listFiles(dir)
          .filter((p) => TEXT_FILE.test(p))
          .map((p) => readFileSync(p, 'utf8'))
          .join('\n');
        for (const attribute of ['data-theme', 'data-density', 'data-digits']) {
          assert.ok(text.includes(attribute), `${id}: ${attribute}`);
        }
      });

      it('references no external URL', () => {
        const found = [];
        for (const path of listFiles(dir).filter((p) => TEXT_FILE.test(p))) {
          const urls = readFileSync(path, 'utf8').match(/https?:\/\/[^\s"'`)<>]+/g) ?? [];
          for (const url of urls.filter((u) => !NAMESPACE.test(u))) {
            found.push(`${relative(directionsDir, path)}: ${url}`);
          }
        }
        assert.deepEqual(found, []);
      });

      it('shows people by synthetic names only, each marked with data-person', async () => {
        const entries = await nameLists();
        for (const screen of SCREENS) {
          const html = readFileSync(join(dir, screen), 'utf8');
          const names = [...html.matchAll(/data-person="([^"]*)"/g)].map((m) => m[1]);
          assert.ok(names.length > 0, `${id}/${screen}: no data-person`);
          const outside = names.filter((name) => !isSynthetic(name, entries));
          assert.deepEqual(outside, [], `${id}/${screen}: names outside the synthetic lists`);
        }
      });
    });
  }
});
