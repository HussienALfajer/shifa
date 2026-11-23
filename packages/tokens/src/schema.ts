// The rules of the token source (spec 0.4, criterion 1). `checkSchema` returns one line per
// problem; test/schema.test.ts runs it on the real source and the build refuses a broken one.
import { colorProblem } from './color.ts';
import { isObject, type Layer, MODES, PAIR_CLASSES, type Sources } from './sources.ts';
import {
  containsReference,
  type FlatToken,
  flatten,
  indexTokens,
  referenceOf,
  resolve,
} from './tokens.ts';

/** Groups whose colours carry one meaning everywhere: locked, never themable. */
export const LOCKED_GROUPS = [
  'color.status.',
  'color.sync.',
  'color.alert.',
  'color.queue.',
  'color.clinical.',
];

/** Layers a token of each layer may point at. */
const MAY_REFERENCE: Record<Exclude<Layer, 'primitive'>, Layer[]> = {
  semantic: ['primitive'],
  brand: ['primitive'],
  component: ['semantic', 'brand'],
};

const isNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

function unitProblem(value: unknown, units: string[]): string | null {
  if (isObject(value) && isNumber(value['value']) && units.includes(String(value['unit']))) {
    return null;
  }
  return `must be { value: number, unit: ${units.map((u) => `"${u}"`).join(' | ')} }`;
}

const dimension = (v: unknown) => unitProblem(v, ['px', 'rem']);

function shadowProblem(value: unknown): string | null {
  const layers = Array.isArray(value) ? value : [value];
  for (const layer of layers) {
    if (!isObject(layer)) return 'a shadow is an object or a list of objects';
    const color = colorProblem(layer['color']);
    if (color !== null) return `shadow colour: ${color}`;
    for (const key of ['offsetX', 'offsetY', 'blur', 'spread']) {
      const problem = dimension(layer[key]);
      if (problem !== null) return `shadow ${key} ${problem}`;
    }
  }
  return null;
}

/** DTCG type → what is wrong with a literal value of that type, or null. */
const LITERALS: Record<string, (value: unknown) => string | null> = {
  color: colorProblem,
  dimension,
  duration: (v) => unitProblem(v, ['ms', 's']),
  number: (v) => (isNumber(v) ? null : 'must be a number'),
  fontWeight: (v) => (isNumber(v) && v >= 1 && v <= 1000 ? null : 'must be a weight (1–1000)'),
  fontFamily: (v) =>
    Array.isArray(v) && v.length > 0 && v.every((f) => typeof f === 'string')
      ? null
      : 'must be a list of family names',
  cubicBezier: (v) =>
    Array.isArray(v) && v.length === 4 && v.every(isNumber) ? null : 'must be four numbers',
  shadow: shadowProblem,
};

export const TOKEN_TYPES = Object.keys(LITERALS);

/** A text or icon colour: it is drawn on a surface, so it needs a declared contrast pair. */
export function isForeground(path: string): boolean {
  const last = path.slice(path.lastIndexOf('.') + 1);
  return (
    path.startsWith('color.text.') ||
    path.startsWith('color.icon.') ||
    ['fg', 'text', 'icon'].includes(last) ||
    last.startsWith('on-')
  );
}

const inLockedGroup = (path: string) => LOCKED_GROUPS.some((group) => path.startsWith(group));

function duplicates(tokens: FlatToken[]): string[] {
  const layersOf = new Map<string, Layer[]>();
  for (const t of tokens) layersOf.set(t.path, [...(layersOf.get(t.path) ?? []), t.layer]);
  return [...layersOf]
    .filter(([, layers]) => layers.length > 1)
    .map(([path, layers]) => `${path}: defined more than once (${layers.join(' and ')})`);
}

function checkPrimitive(token: FlatToken, type: string): string[] {
  const problems: string[] = [];
  if (containsReference(token.value)) {
    return [`${token.path}: a primitive token holds a literal value, not a reference`];
  }
  const problem = LITERALS[type]?.(token.value) ?? null;
  if (problem !== null) problems.push(`${token.path}: ${problem}`);
  if (Object.keys(token.modes).length > 0) {
    problems.push(`${token.path}: a primitive token has no modes; modes belong to semantic tokens`);
  }
  return problems;
}

/** One value (the token's own or a mode's) of a semantic, brand or component token. */
function checkReference(
  token: FlatToken,
  layer: Exclude<Layer, 'primitive'>,
  value: unknown,
  label: string,
  index: Map<string, FlatToken>,
): string[] {
  const path = referenceOf(value);
  if (path === null) {
    return [
      `${token.path}: a ${layer} token's ${label} must be a reference to another token ({group.name}), not a literal`,
    ];
  }
  const target = index.get(path);
  if (target === undefined) return [`${token.path}: ${label} reference {${path}} not found`];
  const problems: string[] = [];
  const allowed = MAY_REFERENCE[layer];
  if (!allowed.includes(target.layer)) {
    problems.push(
      `${token.path}: a ${layer} token must reference a ${allowed.join(' or ')} token, not the ${target.layer} token ${path}`,
    );
  }
  if (target.type !== token.type) {
    problems.push(
      `${token.path}: is a ${String(token.type)} token but ${label} {${path}} is a ${String(target.type)}`,
    );
  }
  return problems;
}

function checkDerived(
  token: FlatToken,
  layer: Exclude<Layer, 'primitive'>,
  index: Map<string, FlatToken>,
): string[] {
  const problems = checkReference(token, layer, token.value, 'value', index);
  for (const [mode, value] of Object.entries(token.modes)) {
    if (!(MODES as readonly string[]).includes(mode)) {
      problems.push(`${token.path}: unknown mode "${mode}" (modes: ${MODES.join(', ')})`);
    } else if ((mode === 'dark') !== (token.type === 'color')) {
      // The outputs rely on it: themes change colours only, densities change sizes only.
      problems.push(
        `${token.path}: the dark mode is for colours and the compact mode for other values`,
      );
    } else {
      problems.push(...checkReference(token, layer, value, `${mode} value`, index));
    }
  }
  const themed = token.type === 'color' && layer !== 'component';
  if (themed && token.modes['dark'] === undefined) {
    problems.push(
      `${token.path}: a ${layer} colour needs a dark value ($extensions.shifa.modes.dark)`,
    );
  }
  return problems;
}

const CRIMSON = 'color.signal.crimson.';
const CRITICAL = 'color.alert.critical.';

/** Red is for critical clinical alerts only (design principle 1). */
function checkHue(token: FlatToken): string[] {
  const targets = [token.value, ...Object.values(token.modes)]
    .map(referenceOf)
    .filter((path) => path !== null);
  const problems: string[] = [];
  if (!token.path.startsWith(CRITICAL) && targets.some((path) => path.startsWith(CRIMSON))) {
    problems.push(
      `${token.path}: crimson is the clinical-alert red, for color.alert.critical only`,
    );
  }
  return problems;
}

function checkLock(token: FlatToken): string[] {
  if (inLockedGroup(token.path)) {
    if (token.layer !== 'semantic') {
      return [`${token.path}: clinical and status colours belong to the semantic layer`];
    }
    return token.locked
      ? []
      : [`${token.path}: clinical and status colours must be locked ($extensions.shifa.locked)`];
  }
  return token.locked ? [`${token.path}: only clinical and status colours may be locked`] : [];
}

/** A token may not hold other tokens: Style Dictionary would drop them without a word. */
function nested(tokens: FlatToken[]): string[] {
  const paths = new Set(tokens.map((t) => t.path));
  const problems: string[] = [];
  for (const token of tokens) {
    const segments = token.path.split('.');
    for (let depth = segments.length - 1; depth > 0; depth -= 1) {
      const parent = segments.slice(0, depth).join('.');
      if (paths.has(parent)) {
        problems.push(`${token.path}: is inside the token ${parent}; a token cannot be a group`);
      }
    }
  }
  return problems;
}

/** A pair is measured on opaque colours; a translucent one has no contrast of its own. */
function translucent(index: Map<string, FlatToken>, path: string): boolean {
  return ([undefined, 'dark'] as const).some((mode) => {
    try {
      const value = resolve(index, path, mode);
      return isObject(value) && typeof value['alpha'] === 'number' && value['alpha'] < 1;
    } catch {
      return false;
    }
  });
}

function checkToken(token: FlatToken, index: Map<string, FlatToken>): string[] {
  if (token.type === undefined || !TOKEN_TYPES.includes(token.type)) {
    return [`${token.path}: needs a $type (one of ${TOKEN_TYPES.join(', ')})`];
  }
  const problems =
    token.layer === 'primitive'
      ? checkPrimitive(token, token.type)
      : checkDerived(token, token.layer, index);
  if ((token.layer === 'semantic' || token.layer === 'brand') && token.description === undefined) {
    problems.push(
      `${token.path}: a ${token.layer} token needs a usage note ($description on it or on a group above it)`,
    );
  }
  if (token.layer === 'brand' && !token.path.startsWith('color.brand.')) {
    problems.push(`${token.path}: the brand layer holds only color.brand.* slots`);
  }
  return [...problems, ...checkLock(token), ...checkHue(token)];
}

function checkPairs(
  sources: Sources,
  tokens: FlatToken[],
  index: Map<string, FlatToken>,
): string[] {
  const problems: string[] = [];
  const paired = new Set<string>();
  const inPair = new Set<string>();
  for (const pair of sources.pairs) {
    const name = `contrast pair ${pair.text} on ${pair.surface}`;
    if (!(PAIR_CLASSES as readonly string[]).includes(pair.class)) {
      problems.push(`${name}: unknown class "${pair.class}" (${PAIR_CLASSES.join(', ')})`);
    }
    for (const path of [pair.text, pair.surface]) {
      const token = index.get(path);
      if (token === undefined) problems.push(`${name}: ${path} not found`);
      else if (token.type !== 'color') problems.push(`${name}: ${path} is not a colour`);
      else if (token.layer === 'primitive') {
        problems.push(`${name}: ${path} is a primitive; pairs name semantic or brand colours`);
      } else if (translucent(index, path)) {
        problems.push(`${name}: ${path} has an alpha below 1; pairs need opaque colours`);
      }
    }
    paired.add(pair.text);
    inPair.add(pair.text);
    inPair.add(pair.surface);
  }
  for (const token of tokens) {
    const themed = token.layer === 'semantic' || token.layer === 'brand';
    if (!themed || token.type !== 'color') continue;
    if (isForeground(token.path) && !paired.has(token.path)) {
      problems.push(
        `${token.path}: a text or icon colour in no contrast pair (add it to src/contrast-pairs.json)`,
      );
    } else if (needsPair(token.path) && !inPair.has(token.path)) {
      problems.push(
        `${token.path}: a colour in no contrast pair; every semantic and brand colour outside bg and border is drawn on a surface or under text (add it to src/contrast-pairs.json)`,
      );
    }
  }
  return [...problems, ...componentPairs(sources, tokens)];
}

const lastSegment = (path: string) => path.slice(path.lastIndexOf('.') + 1);
const parentOf = (path: string) => path.slice(0, path.lastIndexOf('.'));

/**
 * Surfaces and lines carry no text of their own: these need no pair. Every other colour does
 * (slice 0.4-03).
 */
function needsPair(path: string): boolean {
  if (['color.bg.', 'color.border.'].some((g) => path.startsWith(g))) {
    return false;
  }
  return !/^(?:bg|border)(?:-|$)/.test(lastSegment(path));
}

/** A component group's `fg` is declared on each of its `bg` siblings (`bg`, `bg-hover`, …). */
function componentPairs(sources: Sources, tokens: FlatToken[]): string[] {
  const declared = new Set(sources.pairs.map((p) => `${p.text} on ${p.surface}`));
  const colours = tokens.filter((t) => t.layer === 'component' && t.type === 'color');
  const problems: string[] = [];
  for (const fg of colours.filter((t) => lastSegment(t.path) === 'fg')) {
    const group = parentOf(fg.path);
    for (const bg of colours) {
      if (parentOf(bg.path) !== group || !/^bg(?:-|$)/.test(lastSegment(bg.path))) continue;
      const name = `${fg.path} on ${bg.path}`;
      if (!declared.has(name)) {
        problems.push(
          `component pair ${name}: not a declared contrast pair (add it to src/contrast-pairs.json)`,
        );
      }
    }
  }
  return problems;
}

/** Every problem of the token source; empty when it is valid. */
export function checkSchema(sources: Sources): string[] {
  const tokens = flatten(sources);
  const index = indexTokens(tokens);
  return [
    ...duplicates(tokens),
    ...nested(tokens),
    ...tokens.flatMap((token) => checkToken(token, index)),
    ...checkPairs(sources, tokens, index),
  ];
}
