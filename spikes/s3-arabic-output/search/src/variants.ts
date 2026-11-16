// Spelling variants a receptionist might type for a stored display name. RULE_VARIANTS are the
// normaliser's rules (each must still find the patient); PROBE_VARIANTS are outside the rules and
// are only measured (variants still missed, criterion 9). Each returns undefined when the name
// offers nothing to vary.
import type { Random } from '@shifa/testing';

export interface Variant {
  id: string;
  apply(display: string, random: Random): string | undefined;
}

const HARAKAT = ['\u{064E}', '\u{064F}', '\u{0650}', '\u{0651}', '\u{0652}', '\u{064B}'];
/** Letters that do not join to the next one: tatweel after them is not typed. */
const NON_JOINING = new Set(Array.from('اأإآدذرزوؤةىء'));
const isArabicLetter = (ch: string | undefined) =>
  ch !== undefined && /[\u{0621}-\u{064A}]/u.test(ch);

const words = (s: string) => s.split(' ');
const changed = (from: string, to: string) => (to === from ? undefined : to);

/** Replaces the first match of `re` at a word end (end of string or before a space). */
function swapFinal(display: string, from: string, to: string): string | undefined {
  const out = words(display).map((w) => (w.endsWith(from) ? w.slice(0, -1) + to : w));
  return changed(display, out.join(' '));
}

export const RULE_VARIANTS: readonly Variant[] = [
  {
    id: 'tashkeel',
    apply: (display, random) => {
      let out = '';
      for (const ch of display)
        out += ch + (isArabicLetter(ch) && random.chance(0.5) ? random.pick(HARAKAT) : '');
      return changed(display, out);
    },
  },
  {
    id: 'tatweel',
    apply: (display, random) => {
      const chars = Array.from(display);
      const spots = chars.flatMap((ch, i) =>
        isArabicLetter(ch) && !NON_JOINING.has(ch) && isArabicLetter(chars[i + 1]) ? [i] : [],
      );
      if (spots.length === 0) return undefined;
      const at = random.pick(spots);
      return [...chars.slice(0, at + 1), '\u{0640}', ...chars.slice(at + 1)].join('');
    },
  },
  {
    id: 'alef',
    apply: (display) => {
      if (/[أإآ]/u.test(display)) return display.replace(/[أإآ]/gu, 'ا');
      const out = words(display).map((w) =>
        w.startsWith('ا') && !w.startsWith('ال') ? `أ${w.slice(1)}` : w,
      );
      return changed(display, out.join(' '));
    },
  },
  {
    id: 'hamza-carrier',
    apply: (display) => changed(display, display.replace(/ئ/gu, 'ي').replace(/ؤ/gu, 'و')),
  },
  {
    id: 'teh-marbuta',
    apply: (display) => swapFinal(display, 'ة', 'ه') ?? swapFinal(display, 'ه', 'ة'),
  },
  {
    id: 'alef-maksura',
    apply: (display) => swapFinal(display, 'ى', 'ي') ?? swapFinal(display, 'ي', 'ى'),
  },
  {
    id: 'particle',
    apply: (display) => {
      const joined = display.replace(/(^| )(عبد|أبو|ابو|أم|ابن|بن|بنت) /gu, '$1$2');
      return changed(display, joined);
    },
  },
  {
    id: 'whitespace',
    apply: (display) => changed(display, ` ${display.replace(/ /g, '\u{00A0} ')}  `),
  },
];

export const PROBE_VARIANTS: readonly Variant[] = [
  {
    id: 'probe-drop-article',
    apply: (display) => {
      const out = words(display).map((w) => (w.startsWith('ال') && w.length > 3 ? w.slice(2) : w));
      return changed(display, out.join(' '));
    },
  },
  {
    id: 'probe-given-and-family',
    apply: (display) => {
      const parts = words(display);
      if (parts.length < 3) return undefined;
      return `${parts[0] ?? ''} ${parts.at(-1) ?? ''}`;
    },
  },
  {
    id: 'probe-swap-letters',
    apply: (display, random) => {
      const chars = Array.from(display);
      const spots = chars.flatMap((ch, i) =>
        isArabicLetter(ch) && isArabicLetter(chars[i + 1]) && ch !== chars[i + 1] ? [i] : [],
      );
      if (spots.length === 0) return undefined;
      const at = random.pick(spots);
      [chars[at], chars[at + 1]] = [chars[at + 1] ?? '', chars[at] ?? ''];
      return chars.join('');
    },
  },
  {
    id: 'probe-missing-letter',
    apply: (display, random) => {
      const chars = Array.from(display);
      const spots = chars.flatMap((ch, i) =>
        isArabicLetter(ch) && isArabicLetter(chars[i - 1]) ? [i] : [],
      );
      if (spots.length === 0) return undefined;
      const at = random.pick(spots);
      return [...chars.slice(0, at), ...chars.slice(at + 1)].join('');
    },
  },
];
