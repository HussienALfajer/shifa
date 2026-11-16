// Deterministic synthetic data for the four documents (PLT-50): people, phones and prices come
// from @shifa/testing with a fixed seed; nothing is hand-typed that resembles a real person.
// Amounts are display data only: the receipt shows what the fixture says, no money logic here.
import {
  type Currency,
  createRandom,
  fullName,
  generatePersonName,
  generatePhone,
  generatePrice,
  type Money,
} from '@shifa/testing';

const random = createRandom(30_033);
const person = (label: string, sex: 'male' | 'female') =>
  generatePersonName(random.fork(label), { sex, adult: true, region: 'aleppo' });

const doctor = person('doctor', 'male');
const patient = person('patient', 'female');

export const CLINIC = `عيادة د. ${doctor.given} ${doctor.family}`;
export const DOCTOR = `د. ${doctor.given} ${doctor.family}`;
export const PATIENT = fullName(patient);
export const PHONE = generatePhone(random.fork('phone'), 'SY');
export const DATE = '2026-11-16';
export const TIME = '10:35';

export interface PrescriptionItem {
  /** Latin generic name and dose: kept left-to-right inside the Arabic line. */
  drug: string;
  /** Arabic instruction; `{n}` placeholders are numbers formatted in the chosen digit style. */
  instruction: string;
  numbers: number[];
}

/** Generic (INN) drug names: medicines, not people. The last one is long on purpose (wrapping). */
export const PRESCRIPTION_ITEMS: readonly PrescriptionItem[] = [
  {
    drug: 'Amoxicillin 500 mg',
    instruction: 'كبسولة واحدة {0} مرات يوميًا بعد الطعام لمدة {1} أيام',
    numbers: [3, 7],
  },
  {
    drug: 'Paracetamol 500 mg',
    instruction: 'قرص واحد عند اللزوم، بحد أقصى {0} أقراص في اليوم',
    numbers: [4],
  },
  { drug: 'Ibuprofen 400 mg', instruction: 'قرص واحد كل {0} ساعات مع الطعام', numbers: [8] },
  {
    drug: 'Amoxicillin + Clavulanic acid (Co-amoxiclav) 875 mg / 125 mg film-coated tablets',
    instruction:
      'قرص واحد صباحًا ومساءً لمدة {0} أيام، ويُراجع الطبيب إذا استمرت الحرارة أكثر من {1} ساعة',
    numbers: [10, 48],
  },
];

export interface ReceiptLine {
  label: string;
  price: Money;
}

const SERVICES = [
  'كشف أسنان',
  'تنظيف وتلميع',
  'حشوة تجميلية',
  'صورة شعاعية',
  'تخدير موضعي',
  'متابعة',
];
export const RECEIPT_LINES: readonly ReceiptLine[] = SERVICES.slice(0, 4).map((label, index) => ({
  label,
  price: generatePrice(random.fork(`line-${String(index)}`), 'SYP'),
}));
/** The long receipt (no cut across a thermal "page"): many lines. */
export const LONG_RECEIPT_LINES: readonly ReceiptLine[] = Array.from(
  { length: 36 },
  (_, index) => ({
    label: `${SERVICES[index % SERVICES.length] ?? ''} (${String(index + 1)})`,
    price: generatePrice(random.fork(`long-${String(index)}`), 'SYP'),
  }),
);

const sum = (lines: readonly ReceiptLine[]) =>
  lines.reduce((acc, line) => acc + line.price.amountMinor, 0n);

export interface ReceiptTotals {
  totalMinor: bigint;
  tenders: Money[];
  changeMinor: bigint;
  roundingMinor: bigint;
  balanceMinor: bigint;
  /** Display rate: SYP per 1 USD, as written on the footer. */
  rate: { currency: Currency; perUsd: number };
}

/**
 * Fixed display figures for the BIL-30 lines, for layout only: they are not computed by any
 * money rule and do not add up (tender, change and balance). Phase A replaces them with real
 * billing output before the goldens are reused.
 */
export function receiptTotals(lines: readonly ReceiptLine[]): ReceiptTotals {
  const totalMinor = sum(lines);
  return {
    totalMinor,
    tenders: [
      { currency: 'USD', amountMinor: 2_000n },
      { currency: 'SYP', amountMinor: totalMinor },
    ],
    changeMinor: 50_000n,
    roundingMinor: 500n,
    balanceMinor: 0n,
    rate: { currency: 'SYP', perUsd: 118 },
  };
}

export const RECEIPT_NUMBER = 1042;

export interface ReportRow {
  name: string;
  visits: number;
  amount: Money;
}

/** 60 rows: enough for an A4 report of at least two pages. */
export const REPORT_ROWS: readonly ReportRow[] = Array.from({ length: 60 }, (_, index) => {
  const r = random.fork(`row-${String(index)}`);
  return {
    name: fullName(
      generatePersonName(r.fork('name'), {
        sex: r.chance(0.5) ? 'male' : 'female',
        adult: true,
        region: r.chance(0.3) ? 'azaz' : 'aleppo',
      }),
    ),
    visits: r.int(1, 12),
    amount: generatePrice(r.fork('amount'), 'SYP'),
  };
});

export const TICKET = {
  number: 42,
  practitioner: DOCTOR,
  /** A synthetic URL string for the QR code; never fetched. */
  qrPayload: 'https://booking.example.invalid/t/0042',
};
