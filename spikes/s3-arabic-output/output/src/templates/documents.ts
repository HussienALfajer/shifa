// The four document types (spec criterion 2). Each returns a full HTML page in the chosen digit
// style plus the strings a PDF text extraction must give back (criterion 3).
import { type DigitStyle, digitsOf, formatDate, formatNumber } from '../digits.ts';
import {
  CLINIC,
  DATE,
  DOCTOR,
  LONG_RECEIPT_LINES,
  PATIENT,
  PHONE,
  PRESCRIPTION_ITEMS,
  RECEIPT_LINES,
  RECEIPT_NUMBER,
  REPORT_ROWS,
  type ReceiptLine,
  receiptTotals,
  TICKET,
  TIME,
} from '../fixtures.ts';
import { page, rollCss } from './css.ts';
import { cssString, esc, fill, ltr, money, qrSvg } from './html.ts';

/** Day, month and year of a date, each in the digit style. */
const dateParts = (iso: string, digits: DigitStyle): string[] =>
  iso.split('-').map((part) => digitsOf(part, digits));

export interface Rendered {
  html: string;
  expected: string[];
}

export function prescription(digits: DigitStyle): Rendered {
  const items = PRESCRIPTION_ITEMS.map(
    (
      item,
      index,
    ) => `<li><div class="drug">${formatNumber(index + 1, digits)}. ${ltr(item.drug)}</div>
      <div>${esc(fill(item.instruction, item.numbers, digits))}</div></li>`,
  ).join('');
  const css = `
@page { size: A5; margin: 12mm 12mm 14mm; }
:root { --base: 11pt; }
ol { list-style: none; padding: 0; margin: 3mm 0; }
li { margin-bottom: 3mm; }
.drug { font-weight: 700; }
.sign { margin-top: 12mm; text-align: end; }`;
  const body = `<header><h1>${esc(CLINIC)}</h1>
<div class="row muted"><span>هاتف: ${ltr(PHONE)}</span><span>التاريخ: ${formatDate(DATE, digits)}</span></div></header>
<hr><h2>وصفة طبية</h2>
<div class="row"><span>المريض: ${esc(PATIENT)}</span></div>
<ol>${items}</ol>
<div class="sign">توقيع الطبيب: ${esc(DOCTOR)}</div>`;
  return {
    html: page(css, body, 'وصفة طبية'),
    expected: [
      CLINIC,
      'وصفة طبية',
      `المريض: ${PATIENT}`,
      PHONE,
      // Date components, not their order: RLM marks do not reach the text layer (report §3).
      ...dateParts(DATE, digits),
      ...PRESCRIPTION_ITEMS.slice(0, 3).map((i) => i.drug),
      'Co-amoxiclav',
      fill(PRESCRIPTION_ITEMS[0]?.instruction ?? '', PRESCRIPTION_ITEMS[0]?.numbers ?? [], digits),
      `توقيع الطبيب: ${DOCTOR}`,
    ],
  };
}

export function receipt(digits: DigitStyle, widthMm: 80 | 58, long = false): Rendered {
  const lines: readonly ReceiptLine[] = long ? LONG_RECEIPT_LINES : RECEIPT_LINES;
  const t = receiptTotals(lines);
  const syp = (amountMinor: bigint) => money({ currency: 'SYP', amountMinor }, digits);
  const row = (label: string, value: string, cls = '') =>
    `<div class="row ${cls}"><span>${esc(label)}</span><span class="num">${esc(value)}</span></div>`;
  const body = `<div class="center"><h2>${esc(CLINIC)}</h2>
<div class="muted">إيصال رقم ${formatNumber(RECEIPT_NUMBER, digits, 0, false)} — ${formatDate(DATE, digits)} ${digitsOf(TIME, digits)}</div>
<div class="muted">المريض: ${esc(PATIENT)}</div></div><hr>
${lines.map((l) => row(l.label, money(l.price, digits))).join('\n')}
<hr>${row('المجموع', syp(t.totalMinor), 'total')}
${t.tenders.map((m) => row(`المدفوع (${m.currency === 'USD' ? 'دولار' : 'ليرة'})`, money(m, digits))).join('\n')}
${row('الباقي', syp(t.changeMinor))}
${row('التقريب', syp(t.roundingMinor))}
${row('الرصيد المتبقي', syp(t.balanceMinor))}
<hr><div class="center muted">سعر الصرف: ${ltr('1 USD')} = ${formatNumber(t.rate.perUsd, digits)} ل.س</div>
<div class="center muted">شكرًا لزيارتكم</div>
<div class="tear-off"></div>`;
  const printable = widthMm === 80 ? 72 : 48;
  return {
    html: page(rollCss(printable, widthMm === 80 ? '10pt' : '9pt'), body, 'إيصال'),
    expected: [
      'المجموع',
      syp(t.totalMinor),
      'الباقي',
      'التقريب',
      'الرصيد المتبقي',
      'سعر الصرف',
      `إيصال رقم ${formatNumber(RECEIPT_NUMBER, digits, 0, false)}`,
      ...lines.slice(0, 3).map((l) => l.label),
      'شكرًا لزيارتكم',
    ],
  };
}

export const REPORT_TITLE = 'تقرير زيارات المرضى';

export function report(digits: DigitStyle): Rendered {
  const counter = digits === 'arab' ? 'arabic-indic' : 'decimal';
  const css = `
@page {
  size: A4; margin: 22mm 15mm 18mm;
  @top-center { content: ${cssString(`${CLINIC} — ${REPORT_TITLE}`)}; font-family: 'Shifa Arabic'; font-size: 9pt; }
  @bottom-center { content: "صفحة " counter(page, ${counter}) " من " counter(pages, ${counter}); font-family: 'Shifa Arabic'; font-size: 9pt; }
}
:root { --base: 10pt; }
th { border-bottom: 0.4mm solid #000; }
td { border-bottom: 0.1mm solid #888; }`;
  const rows = REPORT_ROWS.map(
    (r, i) =>
      `<tr><td class="num">${formatNumber(i + 1, digits)}</td><td>${esc(r.name)}</td><td class="num">${formatNumber(r.visits, digits)}</td><td class="num">${esc(money(r.amount, digits))}</td></tr>`,
  ).join('\n');
  const body = `<h1>${REPORT_TITLE}</h1>
<div class="muted">الفترة: ${formatDate('2026-10-01', digits)} إلى ${formatDate('2026-10-31', digits)}</div>
<table><thead><tr><th>#</th><th>اسم المريض</th><th>عدد الزيارات</th><th>المبلغ</th></tr></thead>
<tbody>${rows}</tbody></table>`;
  return {
    html: page(css, body, REPORT_TITLE),
    expected: [
      REPORT_TITLE,
      'اسم المريض',
      'عدد الزيارات',
      ...REPORT_ROWS.slice(0, 3).map((r) => r.name),
      REPORT_ROWS.at(-1)?.name ?? '',
    ],
  };
}

export function ticket(digits: DigitStyle, widthMm: 80 | 58): Rendered {
  const printable = widthMm === 80 ? 72 : 48;
  const body = `<div class="center"><h2>${esc(CLINIC)}</h2>
<div>رقم الدور</div>
<div class="big num">${formatNumber(TICKET.number, digits, 0, false)}</div>
<div>الطبيب: ${esc(TICKET.practitioner)}</div>
<div class="muted">${formatDate(DATE, digits)} — ${digitsOf(TIME, digits)}</div>
${qrSvg(TICKET.qrPayload, widthMm === 80 ? 30 : 24)}
<div class="muted">امسح الرمز لمتابعة دورك</div></div>
<div class="tear-off"></div>`;
  return {
    html: page(rollCss(printable, widthMm === 80 ? '11pt' : '10pt'), body, 'رقم الدور'),
    expected: [
      'رقم الدور',
      formatNumber(TICKET.number, digits, 0, false),
      `الطبيب: ${TICKET.practitioner}`,
      'امسح الرمز لمتابعة دورك',
    ],
  };
}
