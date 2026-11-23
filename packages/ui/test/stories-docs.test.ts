// Spec 0.4 criterion 9 (slice 0.4-11, audit F5): Storybook documents every component. The docs
// addon renders a docs page per stories file (autodocs), every page carries an accessibility
// section (keyboard and screen reader), and every text-bearing component shows the text states.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { basename, join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const pkgDir = join(import.meta.dirname, '..');
const root = join(pkgDir, '..', '..');
const read = (path: string) => readFileSync(path, 'utf8');

const listFiles = (dir: string): string[] =>
  existsSync(dir)
    ? readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
        e.isDirectory() ? listFiles(join(dir, e.name)) : [join(dir, e.name)],
      )
    : [];

const storiesFiles = listFiles(join(pkgDir, 'src'))
  .filter((f) => f.endsWith('.stories.tsx'))
  .sort();

/** `button.stories.tsx` → `button`. */
const componentOf = (file: string) => basename(file, '.stories.tsx');

/** The meta's `docs.description.component`: one single-quoted string literal, `\n` unescaped. */
function componentDescription(source: string): string | undefined {
  const match = /description:\s*\{\s*component:\s*'((?:[^'\\]|\\.)*)'/.exec(source);
  return match?.[1]?.replace(/\\n/g, '\n').replace(/\\(.)/g, '$1');
}

/** The paragraph that starts `**Accessibility.**`, after a blank line. */
function accessibilityParagraph(description: string): string | undefined {
  return description.split('\n\n').find((p) => p.startsWith('**Accessibility.** '));
}

const KEYBOARD = /\bkeys?\b|\bTab\b|\bEnter\b|\bSpace\b|\bArrow|\bEscape\b|no keyboard/;
const SCREEN_READER = /screen reader|announce|aria-|\brole\b/;

/** Stories files with no text, so no text states (spec 0.4, Edge cases). */
const NO_TEXT = ['icon', 'skeleton'];

describe('the docs addon', () => {
  it('is installed at the exact version of the other Storybook packages', () => {
    const manifest = JSON.parse(read(join(pkgDir, 'package.json'))) as {
      devDependencies: Record<string, string>;
    };
    expect(manifest.devDependencies['@storybook/addon-docs']).toBe(
      manifest.devDependencies['storybook'],
    );
  });

  it('is listed in .storybook/main.ts', () => {
    expect(read(join(pkgDir, '.storybook', 'main.ts'))).toContain("'@storybook/addon-docs'");
  });

  it('turns on autodocs once, in .storybook/preview.tsx', () => {
    expect(read(join(pkgDir, '.storybook', 'preview.tsx'))).toMatch(/tags:\s*\[\s*'autodocs'\s*\]/);
  });
});

describe('the accessibility section', () => {
  it('finds the 37 stories files', () => {
    expect(storiesFiles).toHaveLength(37);
  });

  it('reads a description and its accessibility paragraph', () => {
    const source = "description: { component: 'Use it.\\n\\n**Accessibility.** A `button`.' }";
    const description = componentDescription(source);
    expect(description).toBe('Use it.\n\n**Accessibility.** A `button`.');
    expect(accessibilityParagraph(description ?? '')).toBe('**Accessibility.** A `button`.');
  });

  for (const file of storiesFiles) {
    const name = relative(pkgDir, file).replaceAll('\\', '/');
    it(`${name}: usage, then an accessibility paragraph on keyboard and screen reader`, () => {
      const description = componentDescription(read(file));
      expect(description, 'docs.description.component').toBeDefined();
      const paragraph = accessibilityParagraph(description ?? '');
      expect(paragraph, '**Accessibility.** paragraph after a blank line').toBeDefined();
      expect(description?.startsWith('**Accessibility.**'), 'usage comes first').toBe(false);
      expect(paragraph, 'keyboard').toMatch(KEYBOARD);
      expect(paragraph, 'screen reader').toMatch(SCREEN_READER);
    });
  }
});

describe('the text states', () => {
  it('records the files without text in spec 0.4 Edge cases', () => {
    const spec = read(
      join(root, 'docs', 'specs', 'design-system', '0.4-design-system-foundations.md'),
    );
    const line = spec.split('\n').find((l) => l.startsWith('- Mixed-direction text')) ?? '';
    const exempt = /Exempt[^:]*:(.*)$/.exec(line)?.[1] ?? '';
    expect([...exempt.matchAll(/`([a-z-]+)`/g)].map((m) => m[1]).sort()).toEqual(NO_TEXT);
    for (const component of NO_TEXT) {
      expect(storiesFiles.map(componentOf), component).toContain(component);
    }
  });

  for (const file of storiesFiles.filter((f) => !NO_TEXT.includes(componentOf(f)))) {
    const name = relative(pkgDir, file).replaceAll('\\', '/');
    it(`${name} shows the text states`, () => {
      expect(read(file)).toContain('storyStates(');
    });
  }
});
