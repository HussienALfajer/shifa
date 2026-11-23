// Arabic folding for search (slice 0.4-12, OD-40): the one function Combobox (`matchesWordStart`),
// Select's typeahead and the command palette match through, so «احمد» finds «أحمد», «فاطمه» finds
// «فاطمة» and a name stored with harakat is found without them. The rules and their order are
// OD-40's (spike S3, `spikes/s3-arabic-output/search/src/normalise.ts`): NFC; tashkeel, Quranic
// marks, tatweel and bidi controls removed; أ إ آ ٱ → ا, ؤ → و, ئ → ي; word-final ة → ه and ى → ي;
// Arabic-Indic and Persian digits → 0–9; ASCII A–Z lower-cased.
//
// Two OD-40 rules stay out, because they build the stored search key, not a word-start match:
// whitespace runs are not collapsed or trimmed and compound-name particles are not joined. Every
// other rule maps one character to one or to none, so a match can be marked in the original text
// one character at a time (`highlight` in command-palette/normalise.ts).
//
// The Phase A name normaliser (ADR-0034, moved from the spike) must give the same result as this
// function on the shared vectors (`spikes/s3-arabic-output/vectors/name-search-vectors.json`) for
// the rules above; `fold-arabic.test.ts` holds the copied cases. Code points are written as
// escapes so invisible characters stay visible in review.

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

/** An Arabic letter after ة or ى makes it not word-final (OD-40's explicit ranges). */
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

/** Only ASCII A–Z, as OD-40: the same in JavaScript, Dart and PostgreSQL whatever the locale. */
const LATIN_UPPER = /[A-Z]/g;

/** `text` folded for matching; the text shown never changes. */
export function foldArabic(text: string): string {
  return (
    text
      .normalize('NFC')
      .replace(REMOVED, '')
      .replace(FOLDED, (ch) => FOLD.get(ch) ?? ch)
      .replace(FINAL_TEH_MARBUTA, '\u{0647}')
      .replace(FINAL_ALEF_MAKSURA, '\u{064A}')
      .replace(DIGITS, digitValue)
      .replace(LATIN_UPPER, (ch) => ch.toLowerCase())
      // Removing marks can leave a base letter beside a combining mark it now composes with.
      .normalize('NFC')
  );
}

/**
 * Where `query` matches `label` once both are folded, as a range of `label` (UTF-16 indices), or
 * null. Folded one character at a time, so a removed mark or a folded letter keeps its place in
 * the original; a rule that spans several characters finds nothing. `wordStart`: the match must
 * start a word. Marks after the last matched letter (its harakat) belong to the match.
 */
export function foldedMatch(
  label: string,
  query: string,
  {
    normalise = foldArabic,
    wordStart = false,
  }: {
    normalise?: (text: string) => string;
    wordStart?: boolean;
  } = {},
): { start: number; end: number } | null {
  const wanted = normalise(query.trim());
  if (wanted === '') return null;
  // One UTF-16 unit at a time: Arabic letters and their marks are each one unit.
  let folded = '';
  const origin: number[] = [];
  for (let index = 0; index < label.length; index++) {
    const out = normalise(label.charAt(index));
    folded += out;
    origin.push(...Array.from({ length: out.length }, () => index));
  }
  let at = folded.indexOf(wanted);
  while (wordStart && at > 0 && !/\s/u.test(folded.charAt(at - 1))) {
    at = folded.indexOf(wanted, at + 1);
  }
  const start = origin[at];
  const last = origin[at + wanted.length - 1];
  if (at === -1 || start === undefined || last === undefined) return null;
  let end = last + 1;
  while (end < label.length && normalise(label.charAt(end)) === '') end++;
  return { start, end };
}
