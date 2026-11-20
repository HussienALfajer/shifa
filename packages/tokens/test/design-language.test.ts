// Spec 0.4, criteria 4 and 12: the values the Warm direction still owed are in the source, and
// every semantic and brand token carries a usage note ($description on it or on a group above
// it), because the design-system output shows that note next to the token.
import { describe, expect, it } from 'vitest';
import { checkSchema, flatten, loadSources, type Sources, type TokenTree } from '../src/index.ts';
import { validSources } from './fixture.ts';

function broken(change: (sources: Sources) => void): string[] {
  const sources = validSources();
  change(sources);
  return checkSchema(sources);
}

const group = (tree: TokenTree, ...keys: string[]) =>
  keys.reduce((node, key) => node[key] as TokenTree, tree);

describe('usage notes', () => {
  it('a semantic token without a $description on it or above it fails', () => {
    const problems = broken((s) => {
      delete group(s.layers.semantic, 'color', 'text', 'default')['$description'];
    });
    expect(problems).toContainEqual(expect.stringMatching(/^color\.text\.default: .*usage note/));
  });

  it('a brand token without one fails', () => {
    const problems = broken((s) => {
      delete group(s.layers.brand, 'color', 'brand')['$description'];
    });
    expect(problems).toContainEqual(expect.stringMatching(/^color\.brand\.primary: .*usage note/));
  });

  it('a $description on a group above the token counts', () => {
    const problems = broken((s) => {
      delete group(s.layers.semantic, 'color', 'text', 'default')['$description'];
      group(s.layers.semantic, 'color', 'text')['$description'] = 'Text on the surfaces.';
    });
    expect(problems).toEqual([]);
  });

  it('an empty $description does not count', () => {
    const problems = broken((s) => {
      group(s.layers.semantic, 'color', 'text', 'default')['$description'] = ' ';
    });
    expect(problems).toContainEqual(expect.stringMatching(/^color\.text\.default: .*usage note/));
  });

  it('primitive and component tokens need none', () => {
    const tokens = flatten(validSources());
    const primitive = tokens.find((t) => t.layer === 'primitive');
    expect(primitive?.description).toBeUndefined();
    expect(checkSchema(validSources())).toEqual([]);
  });

  it('the flat token carries the nearest note', () => {
    const sources = validSources();
    group(sources.layers.semantic, 'color', 'text')['$description'] = 'Text.';
    const text = flatten(sources).find((t) => t.path === 'color.text.default');
    expect(text?.description).toBe(
      group(sources.layers.semantic, 'color', 'text', 'default')['$description'],
    );
  });
});

describe('the Warm values (design doc, "Design language")', () => {
  const tokens = flatten(loadSources());
  const byPath = new Map(tokens.map((t) => [t.path, t]));
  const has = (path: string) => {
    expect(byPath.has(path), path).toBe(true);
  };

  it('every semantic and brand token has a usage note', () => {
    for (const t of tokens.filter((t) => t.layer === 'semantic' || t.layer === 'brand')) {
      expect(t.description?.trim(), t.path).toBeTruthy();
    }
  });

  it('has named type styles: titles, labels and paragraphs', () => {
    for (const style of ['title.display', 'title.lg', 'title.md', 'title.sm']) {
      for (const part of ['family', 'size', 'weight', 'leading'])
        has(`text.style.${style}.${part}`);
    }
    for (const style of [
      'label.md',
      'label.sm',
      'paragraph.lg',
      'paragraph.md',
      'paragraph.data',
    ]) {
      has(`text.style.${style}.size`);
    }
    has('text.style.paragraph.reading.family');
  });

  it('has the focus ring as an elevation', () => {
    has('elevation.focus');
    has('shadow.focus');
  });

  it('has icon, disabled-text and overlay colours', () => {
    has('color.icon.default');
    has('color.icon.muted');
    has('color.icon-tone.default');
    has('color.icon-tone.current');
    has('color.text.disabled');
    has('color.bg.overlay');
  });

  it('has a selection tint scale', () => {
    for (const step of ['subtle', 'default', 'strong']) has(`color.selection.${step}`);
  });

  it('has an avatar palette of six hues, none of them red', () => {
    const hues = tokens
      .filter((t) => t.path.startsWith('color.avatar.') && t.path.endsWith('.bg'))
      .map((t) => t.path);
    expect(hues.length).toBe(6);
    for (const bg of hues) has(bg.replace(/\.bg$/, '.fg'));
    const avatar = tokens.filter((t) => t.path.startsWith('color.avatar.'));
    for (const t of avatar) {
      expect(JSON.stringify([t.value, t.modes]), t.path).not.toContain('crimson');
    }
  });

  it('the overlay is translucent in both themes', () => {
    const overlay = byPath.get('color.bg.overlay');
    expect(overlay?.modes['dark']).toBeDefined();
  });
});
