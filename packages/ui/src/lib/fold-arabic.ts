// Arabic folding for search (slice 0.4-12, OD-40): `foldArabic` and Combobox's `matchesWordStart`
// live in @shifa/contracts since A-02-03, so the API's clinic search folds and matches exactly as
// Combobox, Select's typeahead and the command palette do (one function, rules and their order in
// that file). This file adds `foldedMatch`, which marks a match in the original text.
//
// The Phase A name normaliser (ADR-0034, moved from the spike) must give the same result as
// `foldArabic` on the shared vectors (`spikes/s3-arabic-output/vectors/name-search-vectors.json`);
// `fold-arabic.test.ts` holds the copied cases.
import { foldArabic, matchesWordStart } from '@shifa/contracts/fold-arabic';

export { foldArabic, matchesWordStart };

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
