// OD-20 (closed 2026-11-20): the product shows Western digits only, and every input accepts
// typed Arabic-Indic (٠–٩) and Eastern Arabic-Indic (۰–۹) digits and stores Western ones.
const ARABIC_INDIC_ZERO = 0x0660;
const EASTERN_ARABIC_INDIC_ZERO = 0x06f0;

/** `text` with every Arabic-Indic or Eastern Arabic-Indic digit replaced by its Western digit. */
export function toWesternDigits(text: string): string {
  return text.replace(/[٠-٩۰-۹]/g, (digit) => {
    const code = digit.charCodeAt(0);
    const zero = code >= EASTERN_ARABIC_INDIC_ZERO ? EASTERN_ARABIC_INDIC_ZERO : ARABIC_INDIC_ZERO;
    return String(code - zero);
  });
}
