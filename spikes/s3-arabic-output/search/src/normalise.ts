// Arabic name-search key (spec 0.3-S3 criterion 7, OD-40). Pure: the stored display name never
// changes, only this key. The Dart port (normaliser_dart) and the SQL function s3.normalise_name
// follow the same steps in the same order; vectors/name-search-vectors.json holds all three equal.
// Code points are written as \u{…} escapes so invisible characters stay visible in review.

/** Tashkeel, superscript alef, Quranic marks, tatweel and bidi controls: removed. */
const REMOVED =
  /[\u{064B}-\u{065F}\u{0670}\u{06D6}-\u{06ED}\u{0640}\u{200E}\u{200F}\u{202A}-\u{202E}\u{2066}-\u{2069}]/gu;

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

/** An Arabic letter makes ة or ى "not word-final". Explicit ranges, the same in TS, Dart, SQL. */
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

/** Only ASCII A–Z: identical in JavaScript, Dart and PostgreSQL whatever the locale. */
const LATIN_UPPER = /[A-Z]/g;

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

export function normaliseName(input: string): string {
  let s = input.normalize('NFC');
  s = s.replace(REMOVED, '');
  s = s.replace(FOLDED, (ch) => FOLD.get(ch) ?? ch);
  s = s.replace(FINAL_TEH_MARBUTA, '\u{0647}').replace(FINAL_ALEF_MAKSURA, '\u{064A}');
  s = s.replace(DIGITS, digitValue);
  s = s.replace(LATIN_UPPER, (ch) => ch.toLowerCase());
  s = s.replace(WHITESPACE, ' ').trim();
  if (s === '') return '';
  // Two passes: the first can create a particle (بن + ت → بنت) that then joins its next word.
  const words = joinParticles(joinParticles(s.split(' ')));
  // Removing marks can leave a base letter next to a combining mark it now composes with.
  return words.join(' ').normalize('NFC');
}
