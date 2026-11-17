// Opt-out keyword match (criterion 4, MSG-14). The folding rules are copied from the ADR-0034
// name normaliser (spikes/s3-arabic-output/search/src/normalise.ts), not imported from another
// throwaway spike: tashkeel, tatweel and bidi controls removed, alef forms folded, Arabic-Indic
// and Persian digits to ASCII, ASCII lower-cased, whitespace collapsed and trimmed.

const REMOVED =
  /[\u{064B}-\u{065F}\u{0670}\u{06D6}-\u{06ED}\u{0640}\u{200E}\u{200F}\u{202A}-\u{202E}\u{2066}-\u{2069}]/gu;
const ALEF_FORMS = /[\u{0622}\u{0623}\u{0625}\u{0671}]/gu;
const DIGITS = /[\u{0660}-\u{0669}\u{06F0}-\u{06F9}]/gu;
const digitValue = (ch: string): string => {
  const code = ch.charCodeAt(0);
  return String(code >= 0x06f0 ? code - 0x06f0 : code - 0x0660);
};
const LATIN_UPPER = /[A-Z]/g;
const WHITESPACE =
  /[\t\n\v\f\r \u{0085}\u{00A0}\u{1680}\u{2000}-\u{200D}\u{2028}\u{2029}\u{202F}\u{205F}\u{3000}\u{FEFF}]+/gu;

export function foldText(input: string): string {
  return input
    .normalize('NFC')
    .replace(REMOVED, '')
    .replace(ALEF_FORMS, '\u{0627}')
    .replace(DIGITS, digitValue)
    .replace(LATIN_UPPER, (ch) => ch.toLowerCase())
    .replace(WHITESPACE, ' ')
    .trim();
}

/** "إيقاف", "ايقاف", "STOP", "stop" after folding (إيقاف and ايقاف fold to the same text). */
const OPT_OUT = new Set(['إيقاف', 'ايقاف', 'stop'].map(foldText));

export const isOptOutKeyword = (text: string): boolean => OPT_OUT.has(foldText(text));
