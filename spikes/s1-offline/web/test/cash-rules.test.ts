// The prototype's cash rules must match the server's (OD-29, criterion 3): same offline types,
// refund limit, and a receipt that shows the rate used and an "offline" mark.
import { MOVEMENT_TYPES, OFFLINE_MOVEMENT_TYPES } from '@shifa-spike/s1-server/commands';
import { describe, expect, it } from 'vitest';
import { canRecord, formatMinor, receiptLines, refundRemaining } from '../src/cash-rules.ts';

describe('cash rules in the prototype', () => {
  it.each(MOVEMENT_TYPES)('allows %s offline exactly when the server does', (type) => {
    expect(canRecord(type, { offline: true }).allowed).toBe(OFFLINE_MOVEMENT_TYPES.includes(type));
    expect(canRecord(type, { offline: false }).allowed).toBe(true);
  });

  it('explains a refused offline type in Arabic', () => {
    expect(canRecord('expense', { offline: true }).messageAr).toMatch(/[؀-ۿ]/);
  });

  it('computes what is left to refund of a sale', () => {
    const sale = { id: 's', type: 'sale', amountMinor: '10000' };
    const refunds = [
      { id: 'r1', type: 'refund', amountMinor: '2500', refundOf: 's' },
      { id: 'r2', type: 'refund', amountMinor: '1500', refundOf: 's' },
      { id: 'x', type: 'refund', amountMinor: '9999', refundOf: 'other' },
    ];
    expect(refundRemaining(sale, [sale, ...refunds])).toBe(6000n);
  });

  it('formats minor units without floats', () => {
    expect(formatMinor('500000', 'SYP')).toBe('5,000.00 ل.س');
    expect(formatMinor('5', 'USD')).toBe('0.05 $');
  });

  it('prints the rate used and an offline mark on an offline receipt', () => {
    const lines = receiptLines({
      id: 'm',
      sessionId: 's',
      type: 'sale',
      currency: 'TRY',
      amountMinor: '12345',
      rateUsed: '41.5',
      offline: true,
    });
    const text = lines.join('\n');
    expect(text).toContain('41.5');
    expect(text).toContain('دون اتصال');
    expect(text).toContain('123.45');
  });
});
