// The Arabic name-search key (ADR-0034, ADR-0052; spec A-03 criteria 4–6; OD-40, OD-145). Moved
// from spike S3 (`spikes/s3-arabic-output/search/src/normalise.ts`, key version 1). Pure, and it
// imports nothing, so the web apps and the API take the same function. The stored display name
// never changes; only this key. The Dart port (`packages/shifa_name_key`) follows the same steps
// in the same order; `vectors/name-search-vectors.json` beside this package holds both equal (a
// rule change edits the vectors first, then every port, and raises NAME_KEY_VERSION).
//
// Steps: 1 NFC; 2 tashkeel, superscript alef, Quranic marks and tatweel removed, and every format
// character (category Cf: bidi controls, ALM U+061C, word joiner U+2060, soft hyphen, tags …)
// except the four zero-width ones step 7 treats as spaces (OD-145); 3 أ إ آ ٱ → ا, ؤ → و, ئ → ي;
// 4 word-final ة → ه and ى → ي; 5 Arabic-Indic and Persian digits → 0–9; 6 Latin capitals
// lower-cased by Unicode's default mapping, no locale rules, İ → i, in Basic Latin, Latin-1, Latin
// Extended-A and -B, Latin Extended Additional and full-width Latin (OD-145, amends OD-40's
// ASCII-only rule; Extended-C and -D stay as typed: Dart's case tables predate them); 7 Unicode spaces, ZWSP, ZWNJ, ZWJ and BOM → one space, trimmed;
// 8 compound-name particles joined to the next word (two passes); 9 NFC again.
//
// `foldArabic` (fold-arabic.ts) keeps OD-40's rules for word-start matching in the UI and the
// stored place keys; it differs from this key on format characters and non-ASCII Latin capitals.
// Code points are written as escapes so invisible characters stay visible in review.

/** The version of the rules below; stored with every name token (ADR-0052). */
export const NAME_KEY_VERSION = 2;

/** Marks and tatweel, and format characters other than ZWSP, ZWNJ, ZWJ and BOM: removed. */
const REMOVED =
  /[\u{064B}-\u{065F}\u{0670}\u{06D6}-\u{06ED}\u{0640}]|(?![\u{200B}-\u{200D}\u{FEFF}])\p{Cf}/gu;

/** أ إ آ ٱ → ا, ؤ → و, ئ → ي. */
const FOLD: ReadonlyMap<string, string> = new Map([
  ['\u{0623}', '\u{0627}'],
  ['\u{0625}', '\u{0627}'],
  ['\u{0622}', '\u{0627}'],
  ['\u{0671}', '\u{0627}'],
  ['\u{0624}', '\u{0648}'],
  ['\u{0626}', '\u{064A}'],
]);
const FOLDED = /[\u{0622}-\u{0626}\u{0671}]/gu;

/** An Arabic letter after ة or ى makes it not word-final (explicit ranges, as in every port). */
const ARABIC_LETTER =
  '\\u{0620}-\\u{063F}\\u{0641}-\\u{064A}\\u{066E}\\u{066F}\\u{0671}-\\u{06D3}\\u{06D5}\\u{06EE}\\u{06EF}\\u{06FA}-\\u{06FC}\\u{06FF}';
const FINAL_TEH_MARBUTA = new RegExp(`\\u{0629}(?![${ARABIC_LETTER}])`, 'gu');
const FINAL_ALEF_MAKSURA = new RegExp(`\\u{0649}(?![${ARABIC_LETTER}])`, 'gu');

/** Arabic-Indic U+0660–0669 and Persian U+06F0–06F9 digits. */
const DIGITS = /[\u{0660}-\u{0669}\u{06F0}-\u{06F9}]/gu;
const digitValue = (ch: string): string => {
  const code = ch.charCodeAt(0);
  return String(code >= 0x06f0 ? code - 0x06f0 : code - 0x0660);
};

/** Upper- and title-case letters of the Latin blocks whose case mapping every port shares. */
const LATIN_CAPITAL = /(?=[\u{0041}-\u{024F}\u{1E00}-\u{1EFF}\u{FF21}-\u{FF3A}])[\p{Lu}\p{Lt}]/gu;
/** İ lower-cases to i + U+0307 by the default mapping; the key keeps the plain i. */
const latinLower = (ch: string): string => (ch === '\u{0130}' ? 'i' : ch.toLowerCase());

/** Unicode spaces, ZWSP, ZWNJ, ZWJ and BOM: each run becomes one space. */
const WHITESPACE =
  /[\t\n\v\f\r \u{0085}\u{00A0}\u{1680}\u{2000}-\u{200D}\u{2028}\u{2029}\u{202F}\u{205F}\u{3000}\u{FEFF}]+/gu;

/** Compound-name particles, as they look after alef folding: عبد ابو ابي ام ابن بن بنت. */
const PARTICLES: ReadonlySet<string> = new Set([
  '\u{0639}\u{0628}\u{062F}',
  '\u{0627}\u{0628}\u{0648}',
  '\u{0627}\u{0628}\u{064A}',
  '\u{0627}\u{0645}',
  '\u{0627}\u{0628}\u{0646}',
  '\u{0628}\u{0646}',
  '\u{0628}\u{0646}\u{062A}',
]);

/** Removes the space after every particle that has a following word. */
function joinParticles(words: readonly string[]): string[] {
  const out: string[] = [];
  let pending = '';
  for (const [index, word] of words.entries()) {
    if (PARTICLES.has(word) && index < words.length - 1) {
      pending += word;
    } else {
      out.push(pending + word);
      pending = '';
    }
  }
  return out;
}

/** The search key of `input`: words separated by one space, or '' when nothing is left. */
export function normaliseName(input: string): string {
  let s = input.normalize('NFC');
  s = s.replace(REMOVED, '');
  s = s.replace(FOLDED, (ch) => FOLD.get(ch) ?? ch);
  s = s.replace(FINAL_TEH_MARBUTA, '\u{0647}').replace(FINAL_ALEF_MAKSURA, '\u{064A}');
  s = s.replace(DIGITS, digitValue);
  s = s.replace(LATIN_CAPITAL, latinLower);
  s = s.replace(WHITESPACE, ' ').trim();
  if (s === '') return '';
  // Two passes: the first can create a particle (بن + ت → بنت) that then joins its next word.
  const words = joinParticles(joinParticles(s.split(' ')));
  // Removing marks can leave a base letter next to a combining mark it now composes with.
  return words.join(' ').normalize('NFC');
}

/** The words of a key (none for an empty key). */
export function keyWords(key: string): string[] {
  return key === '' ? [] : key.split(' ');
}

/** The shortest word prefix that is stored and searched (spec A-03 criterion 21: two letters). */
export const NAME_TOKEN_MIN = 2;
/** Prefixes are stored up to this length; a longer search word matches its first 24 characters. */
export const NAME_TOKEN_MAX = 24;

/** One stored token of a chart's name: a word prefix of one part (ADR-0052). */
export interface NameToken {
  /** 0 given, 1 father, 2 family: the index of the part in the display name. */
  readonly part: number;
  /** The word's place within its part (a part may hold several words). */
  readonly word: number;
  readonly token: string;
  /** True when `token` is the whole word (not cut at NAME_TOKEN_MAX). */
  readonly whole: boolean;
}

/** A word's code points (so a prefix never cuts a surrogate pair). */
const codePoints = (word: string): string[] => Array.from(word);

/**
 * The tokens of a chart's display-name parts: for every word of every part's key, each prefix
 * of NAME_TOKEN_MIN to NAME_TOKEN_MAX characters (one-letter words as themselves), so a typed
 * word is matched by equality (OD-42: no operator that is not leakproof under RLS).
 */
export function nameTokens(parts: readonly (string | null)[]): NameToken[] {
  const out: NameToken[] = [];
  for (const [part, text] of parts.entries()) {
    if (text === null) continue;
    for (const [word, w] of keyWords(normaliseName(text)).entries()) {
      const chars = codePoints(w);
      const last = Math.min(chars.length, NAME_TOKEN_MAX);
      for (let n = Math.min(NAME_TOKEN_MIN, chars.length); n <= last; n += 1) {
        out.push({ part, word, token: chars.slice(0, n).join(''), whole: n === chars.length });
      }
    }
  }
  return out;
}

/** A search word as it is looked up: its first NAME_TOKEN_MAX characters. */
export function lookupToken(word: string): string {
  return codePoints(word).slice(0, NAME_TOKEN_MAX).join('');
}
