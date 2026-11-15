// Cash rules as the prototype applies them before enqueueing; they mirror the server's (OD-29),
// which stays the authority. Amounts are integer minor units in strings/bigint, never floats.
import { type MovementType, OFFLINE_MOVEMENT_TYPES } from '@shifa-spike/s1-server/commands';
import { MESSAGES } from '@shifa-spike/s1-server/messages';
import type { MovementRow } from './engine.ts';

export function canRecord(
  type: MovementType,
  ctx: { offline: boolean },
): { allowed: boolean; messageAr?: string } {
  if (ctx.offline && !OFFLINE_MOVEMENT_TYPES.includes(type)) {
    return { allowed: false, messageAr: MESSAGES.offline_cash_type };
  }
  return { allowed: true };
}

interface Movementish {
  id: string;
  type: string;
  amountMinor: string;
  refundOf?: string;
}

/** What is left to refund of `sale`, given every known movement (server and pending). */
export function refundRemaining(sale: Movementish, all: readonly Movementish[]): bigint {
  const refunded = all
    .filter((m) => m.type === 'refund' && m.refundOf === sale.id)
    .reduce((sum, m) => sum + BigInt(m.amountMinor), 0n);
  return BigInt(sale.amountMinor) - refunded;
}

const SYMBOL: Record<string, string> = { SYP: 'ل.س', TRY: '₺', USD: '$' };

export function formatMinor(minor: string, currency: string): string {
  const value = BigInt(minor);
  const negative = value < 0n;
  const abs = negative ? -value : value;
  const whole = (abs / 100n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const cents = (abs % 100n).toString().padStart(2, '0');
  return `${negative ? '-' : ''}${whole}.${cents} ${SYMBOL[currency] ?? currency}`;
}

const TYPE_AR: Record<string, string> = {
  sale: 'بيع',
  refund: 'استرداد',
  expense: 'مصروف',
  deposit: 'إيداع',
  float_adjust: 'تعديل الرصيد',
};

/** Receipt text (criterion 3): the rate used and, offline, a visible mark. */
export function receiptLines(m: MovementRow): string[] {
  const lines = [
    'إيصال الصندوق',
    `النوع: ${TYPE_AR[m.type] ?? m.type}`,
    `المبلغ: ${formatMinor(m.amountMinor, m.currency)}`,
    `سعر الصرف المستخدم: ${m.rateUsed} ${m.currency} لكل 1 USD`,
    `رقم العملية: ${m.id.slice(0, 8)}`,
  ];
  if (m.offline) lines.push('⚠ دون اتصال — سُجّل محلياً ويُزامن عند عودة الإنترنت');
  return lines;
}
