// Small helpers shared by the templates: escaping, isolated left-to-right runs, money, QR.
import type { Money } from '@shifa/testing';
import QRCode from 'qrcode';
import { type DigitStyle, formatNumber } from '../digits.ts';

const ENTITIES: Readonly<Record<string, string>> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/** Escapes text for HTML content and attribute values. */
export const esc = (text: string): string => text.replace(/[&<>"']/g, (ch) => ENTITIES[ch] ?? ch);

/** Escapes text for a CSS string (page-margin `content`): every non-alphanumeric as a hex escape. */
export function cssString(text: string): string {
  const escaped = Array.from(text, (ch) =>
    /[\p{L}\p{N} ]/u.test(ch) ? ch : `\\${(ch.codePointAt(0) ?? 0x20).toString(16)} `,
  );
  return `"${escaped.join('')}"`;
}

/** A left-to-right run (drug name, dose, phone) isolated inside an Arabic line. */
export const ltr = (text: string): string => `<bdi dir="ltr">${esc(text)}</bdi>`;

const CURRENCY_LABEL: Readonly<Record<Money['currency'], string>> = {
  SYP: 'ل.س',
  TRY: 'ل.ت',
  USD: '$',
};
const FRACTION: Readonly<Record<Money['currency'], number>> = { SYP: 0, TRY: 2, USD: 2 };

/** "12,500 ل.س" / "20.00 $": the amount in the digit style, then the currency label. */
export function money(value: Money, digits: DigitStyle): string {
  const fraction = FRACTION[value.currency];
  const major = Number(value.amountMinor) / 100;
  return `${formatNumber(major, digits, fraction)} ${CURRENCY_LABEL[value.currency]}`;
}

/** Inline SVG QR code (one path), built from the module matrix: no image, no network. */
export function qrSvg(payload: string, sizeMm: number): string {
  const { modules } = QRCode.create(payload, { errorCorrectionLevel: 'M' });
  const n = modules.size;
  let path = '';
  for (let y = 0; y < n; y += 1) {
    for (let x = 0; x < n; x += 1) {
      if (modules.get(y, x)) path += `M${String(x)} ${String(y)}h1v1h-1z`;
    }
  }
  const box = n + 8;
  return `<svg class="qr" xmlns="http://www.w3.org/2000/svg" viewBox="-4 -4 ${String(box)} ${String(box)}" width="${String(sizeMm)}mm" height="${String(sizeMm)}mm" shape-rendering="crispEdges"><rect x="-4" y="-4" width="${String(box)}" height="${String(box)}" fill="#fff"/><path d="${path}" fill="#000"/></svg>`;
}

/** Replaces {0}, {1}… with numbers in the chosen digit style. */
export const fill = (text: string, numbers: readonly number[], digits: DigitStyle): string =>
  text.replace(/\{(\d+)\}/g, (_m, i: string) =>
    formatNumber(numbers[Number(i)] ?? 0, digits, 0, false),
  );
