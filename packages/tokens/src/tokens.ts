// The flat view of the token source: one entry per token with its layer, inherited type, modes
// and lock, and the resolver that follows references in a given mode.
import {
  isObject,
  LAYERS,
  type Layer,
  type Mode,
  type Sources,
  type TokenTree,
} from './sources.ts';

export interface FlatToken {
  /** Dotted path, the same in every layer: `color.bg.surface`. */
  path: string;
  layer: Layer;
  /** `$type` of the token or of the nearest group above it. */
  type: string | undefined;
  value: unknown;
  /** `$extensions.shifa.modes`: the value in dark or in compact density. */
  modes: Record<string, unknown>;
  locked: boolean;
  /** Usage note: the `$description` of the token or of the nearest group above it. */
  description: string | undefined;
}

const REFERENCE = /^\{([^{}]+)\}$/;

/** The path a `{group.token}` reference points at, or null for any other value. */
export function referenceOf(value: unknown): string | null {
  return typeof value === 'string' ? (REFERENCE.exec(value)?.[1] ?? null) : null;
}

/** True when a reference appears anywhere inside a value. */
export function containsReference(value: unknown): boolean {
  if (typeof value === 'string') return /\{[^{}]+\}/.test(value);
  if (Array.isArray(value)) return value.some(containsReference);
  return isObject(value) && Object.values(value).some(containsReference);
}

function walk(
  tree: TokenTree,
  layer: Layer,
  path: string[],
  type: string | undefined,
  note: string | undefined,
  out: FlatToken[],
): void {
  const own = typeof tree['$type'] === 'string' ? tree['$type'] : type;
  const described = typeof tree['$description'] === 'string' ? tree['$description'].trim() : '';
  const description = described === '' ? note : described;
  if ('$value' in tree) {
    const extensions = isObject(tree['$extensions']) ? tree['$extensions']['shifa'] : undefined;
    const shifa = isObject(extensions) ? extensions : {};
    out.push({
      path: path.join('.'),
      layer,
      type: own,
      value: tree['$value'],
      modes: isObject(shifa['modes']) ? shifa['modes'] : {},
      locked: shifa['locked'] === true,
      description,
    });
    // No return: a token nested inside a token is still listed, so the schema can refuse it.
  }
  for (const [key, child] of Object.entries(tree)) {
    if (key.startsWith('$') || !isObject(child)) continue;
    walk(child, layer, [...path, key], own, description, out);
  }
}

/** Every token of every layer, in layer order then source order. */
export function flatten(sources: Sources): FlatToken[] {
  const out: FlatToken[] = [];
  for (const layer of LAYERS) walk(sources.layers[layer], layer, [], undefined, undefined, out);
  return out;
}

/** Path → token; the first definition wins (the schema reports a second one). */
export function indexTokens(tokens: FlatToken[]): Map<string, FlatToken> {
  const index = new Map<string, FlatToken>();
  for (const token of tokens) if (!index.has(token.path)) index.set(token.path, token);
  return index;
}

/** The value a token holds in a mode: its mode value when it has one, else its own. */
export function valueIn(token: FlatToken, mode?: Mode): unknown {
  return mode !== undefined && token.modes[mode] !== undefined ? token.modes[mode] : token.value;
}

/**
 * The literal value of a token in a mode, following references. The mode applies at every step,
 * so a component token follows the semantic colour it points at into dark.
 */
export function resolve(index: Map<string, FlatToken>, path: string, mode?: Mode): unknown {
  const seen: string[] = [];
  let current = path;
  for (;;) {
    if (seen.includes(current))
      throw new Error(`circular reference: ${[...seen, current].join(' → ')}`);
    seen.push(current);
    const token = index.get(current);
    if (token === undefined) throw new Error(`token ${current} not found`);
    const value = valueIn(token, mode);
    const next = referenceOf(value);
    if (next === null) return value;
    current = next;
  }
}
