// Criterion 1: four layers, references resolve, every semantic colour has light and dark,
// clinical and status tokens are locked, every text or icon colour is in a contrast pair.
import { describe, expect, it } from 'vitest';
import {
  checkSchema,
  flatten,
  LAYERS,
  loadSources,
  type Sources,
  srgb,
  type TokenTree,
} from '../src/index.ts';
import { validSources } from './fixture.ts';

/** The problems of the fixture after one change. */
function broken(change: (sources: Sources) => void): string[] {
  const sources = validSources();
  change(sources);
  return checkSchema(sources);
}

/** The group or token at a dotted path of one layer. */
function node(tree: TokenTree, path: string): Record<string, unknown> {
  let current: Record<string, unknown> = tree;
  for (const key of path.split('.')) {
    const next = current[key];
    if (typeof next !== 'object' || next === null) throw new Error(`${path}: nothing at ${key}`);
    current = next as Record<string, unknown>;
  }
  return current;
}

describe('the fixture', () => {
  it('is valid', () => {
    expect(checkSchema(validSources())).toEqual([]);
  });
});

describe('the token source', () => {
  const sources = loadSources();
  const tokens = flatten(sources);

  it('passes the schema', () => {
    expect(checkSchema(sources)).toEqual([]);
  });

  it('has tokens in each of the four layers', () => {
    expect(LAYERS).toEqual(['primitive', 'semantic', 'brand', 'component']);
    for (const layer of LAYERS) {
      expect(tokens.filter((t) => t.layer === layer).length, layer).toBeGreaterThan(0);
    }
  });

  it.each([
    ['colour', 'color'],
    ['typography', 'fontFamily'],
    ['typography weights', 'fontWeight'],
    ['spacing, radius and border widths', 'dimension'],
    ['elevation', 'shadow'],
    ['motion durations', 'duration'],
    ['motion easing', 'cubicBezier'],
    ['z-index and line heights', 'number'],
  ])('covers %s (%s tokens)', (_label, type) => {
    expect(tokens.some((t) => t.type === type)).toBe(true);
  });

  it.each(['space', 'radius', 'border', 'elevation', 'motion', 'z', 'font'])(
    'has the %s group',
    (group) => {
      expect(tokens.some((t) => t.path.startsWith(`${group}.`))).toBe(true);
    },
  );

  it('has both densities: some token changes in compact', () => {
    expect(tokens.some((t) => t.modes['compact'] !== undefined)).toBe(true);
  });

  it('gives every semantic and brand colour a dark value', () => {
    const colours = tokens.filter(
      (t) => t.type === 'color' && (t.layer === 'semantic' || t.layer === 'brand'),
    );
    expect(colours.length).toBeGreaterThan(20);
    for (const t of colours) expect(t.modes['dark'], t.path).toBeDefined();
  });

  it('locks the status, sync, alert and queue colours and nothing else', () => {
    const groups = ['color.status.', 'color.sync.', 'color.alert.', 'color.queue.'];
    for (const group of groups) {
      const members = tokens.filter((t) => t.path.startsWith(group));
      expect(members.length, group).toBeGreaterThan(0);
      for (const t of members) expect(t.locked, t.path).toBe(true);
    }
    for (const t of tokens.filter((t) => t.locked)) {
      expect(
        groups.some((g) => t.path.startsWith(g)),
        t.path,
      ).toBe(true);
    }
  });

  it('has the statuses the product names', () => {
    const paths = new Set(tokens.map((t) => t.path));
    for (const status of ['success', 'warning', 'danger', 'info', 'neutral']) {
      expect(paths.has(`color.status.${status}.fg`), status).toBe(true);
    }
    for (const state of ['saved', 'offline', 'syncing']) {
      expect(paths.has(`color.sync.${state}.fg`), state).toBe(true);
    }
    // SCH-18
    const queue = 'booked confirmed arrived waiting in-room done no-show cancelled'.split(' ');
    for (const status of queue) expect(paths.has(`color.queue.${status}.fg`), status).toBe(true);
  });

  it('has the brand slots a clinic palette replaces (PLT-41)', () => {
    const brand = tokens.filter((t) => t.layer === 'brand').map((t) => t.path);
    expect(brand).toContain('color.brand.primary');
    expect(brand).toContain('color.brand.on-primary');
    for (const path of brand) expect(path.startsWith('color.brand.'), path).toBe(true);
  });
});

describe('layer rules', () => {
  it('a primitive may not reference another token', () => {
    const problems = broken((s) => {
      node(s.layers.primitive, 'color.white')['$value'] = '{color.ink.900}';
    });
    expect(problems.join('\n')).toMatch(/color\.white.*primitive.*literal/);
  });

  it('a semantic token may not hold a literal value', () => {
    const problems = broken((s) => {
      node(s.layers.semantic, 'color.bg')['surface'] = {
        $value: srgb('#FFFFFF'),
        $extensions: { shifa: { modes: { dark: '{color.night.900}' } } },
      };
    });
    expect(problems.join('\n')).toMatch(/color\.bg\.surface.*reference/);
  });

  it('a component token may not reference a primitive', () => {
    const problems = broken((s) => {
      node(s.layers.component, 'button')['primary'] = {
        bg: { $type: 'color', $value: '{color.green.600}' },
      };
    });
    expect(problems.join('\n')).toMatch(/button\.primary\.bg.*semantic or brand/);
  });

  it('the same token may not be defined in two layers', () => {
    const problems = broken((s) => {
      s.layers.brand['space'] = { $type: 'dimension', 8: { $value: '{space.11}' } };
    });
    expect(problems.join('\n')).toMatch(/space\.8.*primitive.*brand/);
  });

  it('a token needs a type', () => {
    const problems = broken((s) => {
      delete node(s.layers.primitive, 'space')['$type'];
    });
    expect(problems.join('\n')).toMatch(/space\.8.*\$type/);
  });

  it('a colour hex must agree with its components', () => {
    const problems = broken((s) => {
      node(s.layers.primitive, 'color.white')['$value'] = {
        ...srgb('#FFFFFF'),
        hex: '#000000',
      };
    });
    expect(problems.join('\n')).toMatch(/color\.white.*hex/);
  });
});

describe('references', () => {
  it('an unresolved reference fails', () => {
    const problems = broken((s) => {
      node(s.layers.semantic, 'color.text.default')['$value'] = '{color.ink.950}';
    });
    expect(problems.join('\n')).toMatch(/color\.text\.default.*\{color\.ink\.950\}.*not found/);
  });

  it('an unresolved dark reference fails', () => {
    const problems = broken((s) => {
      node(s.layers.semantic, 'color.text.default')['$extensions'] = {
        shifa: { modes: { dark: '{color.ink.50}' } },
      };
    });
    expect(problems.join('\n')).toMatch(/color\.text\.default.*dark.*\{color\.ink\.50\}/);
  });

  it('a reference to a token of another type fails', () => {
    const problems = broken((s) => {
      node(s.layers.semantic, 'color.text.default')['$value'] = '{space.8}';
    });
    expect(problems.join('\n')).toMatch(/color\.text\.default.*dimension/);
  });
});

describe('modes and locks', () => {
  it('a semantic colour without a dark value fails', () => {
    const problems = broken((s) => {
      delete node(s.layers.semantic, 'color.text.default')['$extensions'];
    });
    expect(problems.join('\n')).toMatch(/color\.text\.default.*dark/);
  });

  it('a brand colour without a dark value fails', () => {
    const problems = broken((s) => {
      delete node(s.layers.brand, 'color.brand.primary')['$extensions'];
    });
    expect(problems.join('\n')).toMatch(/color\.brand\.primary.*dark/);
  });

  it('an unknown mode fails', () => {
    const problems = broken((s) => {
      node(s.layers.semantic, 'color.text.default')['$extensions'] = {
        shifa: { modes: { dark: '{color.ink.100}', sepia: '{color.ink.100}' } },
      };
    });
    expect(problems.join('\n')).toMatch(/color\.text\.default.*sepia/);
  });

  it('a status colour that is not locked fails', () => {
    const problems = broken((s) => {
      node(s.layers.semantic, 'color.status.success.fg')['$extensions'] = {
        shifa: { modes: { dark: '{color.green.300}' } },
      };
    });
    expect(problems.join('\n')).toMatch(/color\.status\.success\.fg.*locked/);
  });

  it('a clinical colour that is not locked fails', () => {
    const problems = broken((s) => {
      node(s.layers.semantic, 'color')['clinical'] = {
        planned: {
          $value: '{color.green.600}',
          $extensions: { shifa: { modes: { dark: '{color.green.300}' } } },
        },
      };
      s.pairs.push({ text: 'color.clinical.planned', surface: 'color.bg.surface', class: 'ui' });
    });
    expect(problems.join('\n')).toMatch(/color\.clinical\.planned.*locked/);
  });

  it('a lock outside the locked groups fails', () => {
    const problems = broken((s) => {
      node(s.layers.brand, 'color.brand.primary')['$extensions'] = {
        shifa: { locked: true, modes: { dark: '{color.green.300}' } },
      };
    });
    expect(problems.join('\n')).toMatch(/color\.brand\.primary.*locked/);
  });
});

describe('contrast pairs', () => {
  it('a text colour that appears in no pair fails', () => {
    const problems = broken((s) => {
      node(s.layers.semantic, 'color.text')['muted'] = {
        $value: '{color.ink.900}',
        $extensions: { shifa: { modes: { dark: '{color.ink.100}' } } },
      };
    });
    expect(problems.join('\n')).toMatch(/color\.text\.muted.*no contrast pair/);
  });

  it('an icon colour and an on-colour need a pair too', () => {
    const problems = broken((s) => {
      s.pairs = s.pairs.filter((p) => p.text === 'color.text.default');
    });
    const text = problems.join('\n');
    expect(text).toMatch(/color\.status\.success\.fg.*no contrast pair/);
    expect(text).toMatch(/color\.brand\.on-primary.*no contrast pair/);
  });

  it('a pair that names an unknown token fails', () => {
    const problems = broken((s) => {
      s.pairs.push({ text: 'color.text.default', surface: 'color.bg.nowhere', class: 'body' });
    });
    expect(problems.join('\n')).toMatch(/color\.bg\.nowhere.*not found/);
  });

  it('a pair with an unknown class fails', () => {
    const problems = broken((s) => {
      s.pairs.push({
        text: 'color.text.default',
        surface: 'color.bg.surface',
        class: 'tiny' as 'body',
      });
    });
    expect(problems.join('\n')).toMatch(/tiny/);
  });
});

describe('icon pairs follow text pairs (C-5)', () => {
  /** The fixture with an icon colour paired on its one surface. */
  const withIcon = (): Sources => {
    const sources = validSources();
    const colour = node(sources.layers.semantic, 'color');
    colour['icon'] = {
      default: {
        $description: 'Icons.',
        $value: '{color.ink.900}',
        $extensions: { shifa: { modes: { dark: '{color.ink.100}' } } },
      },
    };
    sources.pairs.push({ text: 'color.icon.default', surface: 'color.bg.surface', class: 'ui' });
    return sources;
  };

  it('a source whose text surfaces all carry an icon pair passes', () => {
    expect(checkSchema(withIcon())).toEqual([]);
  });

  it('fails on a surface with a text pair and no icon pair', () => {
    const sources = withIcon();
    node(sources.layers.semantic, 'color.bg')['sunken'] = {
      $description: 'Wells.',
      $value: '{color.ink.100}',
      $extensions: { shifa: { modes: { dark: '{color.night.900}' } } },
    };
    sources.pairs.push({ text: 'color.text.default', surface: 'color.bg.sunken', class: 'body' });
    expect(checkSchema(sources).join('\n')).toMatch(
      /color\.bg\.sunken: a surface with a text pair and no color\.icon\.\* pair/,
    );
    sources.pairs.push({ text: 'color.icon.default', surface: 'color.bg.sunken', class: 'ui' });
    expect(checkSchema(sources)).toEqual([]);
  });
});
