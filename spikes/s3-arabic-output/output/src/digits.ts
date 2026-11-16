// Digit styles (OD-20 stays open): every template takes one and formats all its numbers with it.
export const DIGIT_STYLES = ['latn', 'arab'] as const;
export type DigitStyle = (typeof DIGIT_STYLES)[number];

const formatters = new Map<string, Intl.NumberFormat>();

/** Formats `n` in Syrian Arabic with Western (`latn`) or Arabic-Indic (`arab`) digits. */
export function formatNumber(
  n: number,
  style: DigitStyle,
  fractionDigits = 0,
  grouping = true,
): string {
  const key = `${style}/${String(fractionDigits)}/${String(grouping)}`;
  let formatter = formatters.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat(`ar-SY-u-nu-${style}`, {
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
      useGrouping: grouping,
    });
    formatters.set(key, formatter);
  }
  return formatter.format(n);
}

/**
 * A calendar date (YYYY-MM-DD) in the Syrian Arabic order day/month/year. Intl puts an RLM after
 * each number, so the date reads right to left in either digit style: an ISO date inside Arabic
 * text is reordered by the bidi algorithm ("2026-11-16" shows as "16-11-2026").
 */
export function formatDate(isoDate: string, style: DigitStyle): string {
  return new Intl.DateTimeFormat(`ar-SY-u-nu-${style}`, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: 'UTC',
  }).format(new Date(`${isoDate}T00:00:00Z`));
}

/** Converts the Western digits of a string (a time, a code) to the chosen style. */
export function digitsOf(text: string, style: DigitStyle): string {
  if (style === 'latn') return text;
  return text.replace(/[0-9]/g, (d) => String.fromCharCode(0x0660 + Number(d)));
}
