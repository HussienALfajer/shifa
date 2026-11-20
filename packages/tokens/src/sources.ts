// The token source: src/<layer>/*.tokens.json (DTCG 2025.10) and src/contrast-pairs.json.
// Shifa's additions live under `$extensions.shifa`: `modes` (the value in dark or in compact
// density) and `locked` (clinical and status colours no theme may change).
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export const LAYERS = ['primitive', 'semantic', 'brand', 'component'] as const;
export type Layer = (typeof LAYERS)[number];

export const MODES = ['dark', 'compact'] as const;
export type Mode = (typeof MODES)[number];

export const PAIR_CLASSES = ['body', 'large', 'ui'] as const;
export type PairClass = (typeof PAIR_CLASSES)[number];

/** A DTCG group: nested groups and tokens (objects with `$value`). */
export type TokenTree = Record<string, unknown>;

/** A text or icon colour and a surface it is drawn on, by token path. */
export interface ContrastPair {
  text: string;
  surface: string;
  class: PairClass;
}

export interface Sources {
  layers: Record<Layer, TokenTree>;
  pairs: ContrastPair[];
}

export const SOURCE_DIR = import.meta.dirname;

export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Merges the files of one layer; two files defining the same token is an error. */
function merge(into: TokenTree, from: TokenTree, path: string, file: string): void {
  for (const [key, value] of Object.entries(from)) {
    const here = path === '' ? key : `${path}.${key}`;
    const existing = into[key];
    if (existing === undefined) {
      into[key] = value;
    } else if (isObject(existing) && isObject(value) && !('$value' in existing)) {
      merge(existing, value, here, file);
    } else if (!(key === '$type' && existing === value)) {
      // Two files may open the same group (`color`) with the same `$type`; nothing else repeats.
      throw new Error(`${file}: ${here} is already defined in another file of this layer`);
    }
  }
}

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, 'utf8'));
}

/** Reads every layer directory and the contrast pairs. Throws on malformed files. */
export function loadSources(dir: string = SOURCE_DIR): Sources {
  const layers = {} as Record<Layer, TokenTree>;
  for (const layer of LAYERS) {
    const tree: TokenTree = {};
    for (const file of readdirSync(join(dir, layer)).sort()) {
      if (!file.endsWith('.tokens.json')) continue;
      const doc = readJson(join(dir, layer, file));
      if (!isObject(doc)) throw new Error(`${layer}/${file}: expected a token group`);
      merge(tree, doc, '', `${layer}/${file}`);
    }
    layers[layer] = tree;
  }
  const pairs = readJson(join(dir, 'contrast-pairs.json'));
  if (!Array.isArray(pairs)) throw new Error('contrast-pairs.json: expected a list of pairs');
  return { layers, pairs: pairs as ContrastPair[] };
}
