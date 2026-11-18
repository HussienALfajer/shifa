// Numbers as Arabic words (criterion 3): Modern Standard Arabic, nominative, the masculine
// counting form read after "الرقم" (and after "رقم" in the room phrase). No tashkeel: the same
// plain text goes to every provider. 1-999 only; a queue number outside that range is refused.

const UNITS = ['', 'واحد', 'اثنان', 'ثلاثة', 'أربعة', 'خمسة', 'ستة', 'سبعة', 'ثمانية', 'تسعة'];
const TEENS = [
  'عشرة',
  'أحد عشر',
  'اثنا عشر',
  'ثلاثة عشر',
  'أربعة عشر',
  'خمسة عشر',
  'ستة عشر',
  'سبعة عشر',
  'ثمانية عشر',
  'تسعة عشر',
];
const TENS = ['', '', 'عشرون', 'ثلاثون', 'أربعون', 'خمسون', 'ستون', 'سبعون', 'ثمانون', 'تسعون'];
const HUNDREDS = [
  '',
  'مئة',
  'مئتان',
  'ثلاثمئة',
  'أربعمئة',
  'خمسمئة',
  'ستمئة',
  'سبعمئة',
  'ثمانمئة',
  'تسعمئة',
];

function below100(n: number): string {
  if (n < 10) return UNITS[n] ?? '';
  if (n < 20) return TEENS[n - 10] ?? '';
  const unit = n % 10;
  const tens = TENS[Math.floor(n / 10)] ?? '';
  // Units come first: واحد وعشرون.
  return unit === 0 ? tens : `${UNITS[unit] ?? ''} و${tens}`;
}

export function numberToArabicWords(n: number): string {
  if (!Number.isInteger(n) || n < 1 || n > 999) {
    throw new RangeError(`number out of range 1-999: ${String(n)}`);
  }
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  if (hundreds === 0) return below100(rest);
  const head = HUNDREDS[hundreds] ?? '';
  return rest === 0 ? head : `${head} و${below100(rest)}`;
}
