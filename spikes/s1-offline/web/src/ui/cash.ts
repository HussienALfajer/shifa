// Cash panel (OD-29): open/close online only; offline only sales and refunds at the session's
// last synced rate; the receipt shows that rate and an offline mark.
import {
  CURRENCIES,
  MOVEMENT_TYPES,
  type MovementType,
  OFFLINE_MOVEMENT_TYPES,
} from '@shifa-spike/s1-server/commands';
import { canRecord, formatMinor, receiptLines, refundRemaining } from '../cash-rules.ts';
import type { Command, MovementRow } from '../engine.ts';
import type { Ctx } from './context.ts';
import { field, h, kids, toMinor, uuid } from './dom.ts';

/** The last online-only action's error, shown until the next one (survives re-renders). */
let notice = '';

async function sendNow(ctx: Ctx, command: Command): Promise<void> {
  notice = (await ctx.sendNow(command)) ?? '';
  ctx.rerender();
}

const DEFAULT_RATES = { SYP: '11000', TRY: '41.5', USD: '1' };
const TYPE_AR: Record<MovementType, string> = {
  sale: 'بيع',
  refund: 'استرداد',
  expense: 'مصروف',
  deposit: 'إيداع',
  float_adjust: 'تعديل الرصيد',
};
let lastReceiptId: string | undefined;

function totals(movements: MovementRow[]): string[] {
  return CURRENCIES.map((c) => {
    const sum = movements
      .filter((m) => m.currency === c)
      .reduce(
        (s, m) =>
          s + (m.type === 'sale' || m.type === 'deposit' ? 1n : -1n) * BigInt(m.amountMinor),
        0n,
      );
    return `${c}: ${formatMinor(sum.toString(), c)}`;
  });
}

export function cashSection(ctx: Ctx): HTMLElement {
  const offline = ctx.offline();
  const open = ctx.today.sessions.find((s) => !s.closed);
  const section = h('section', { 'data-testid': 'cash' }, h('h2', {}, 'الصندوق'));
  if (!open) {
    section.append(
      h(
        'button',
        {
          type: 'button',
          'data-testid': 'open-session',
          disabled: offline,
          onclick: () =>
            void sendNow(ctx, {
              ...ctx.envelope(),
              type: 'cash.open',
              payload: { sessionId: uuid(), rates: DEFAULT_RATES },
            }),
        },
        'فتح الصندوق',
      ),
      h('p', { class: 'note', 'data-testid': 'cash-message' }, notice),
    );
    if (offline) section.append(h('p', { class: 'note' }, 'فتح الصندوق يحتاج اتصالاً بالإنترنت.'));
    return section;
  }
  const movements = ctx.today.movements.filter((m) => m.sessionId === open.id);
  const form = h('form', { 'data-testid': 'cash-form' }) as HTMLFormElement;
  const type = h('select', { name: 'type' });
  for (const t of MOVEMENT_TYPES) {
    const rule = canRecord(t, { offline });
    type.append(h('option', { value: t, disabled: !rule.allowed }, TYPE_AR[t]));
  }
  const currency = h('select', { name: 'currency' });
  for (const c of CURRENCIES) currency.append(h('option', { value: c }, c));
  const sale = h(
    'select',
    { name: 'refundOf' },
    h('option', { value: '' }, '— عملية البيع (للاسترداد) —'),
  );
  for (const m of movements.filter((x) => x.type === 'sale')) {
    const left = refundRemaining(m, movements);
    if (left > 0n)
      sale.append(
        h(
          'option',
          { value: m.id },
          `${m.id.slice(0, 8)} — ${formatMinor(left.toString(), m.currency)}`,
        ),
      );
  }
  const message = h('p', { class: 'note', 'data-testid': 'cash-message' }, notice);
  form.append(
    h('label', {}, 'النوع', type),
    h('label', {}, 'العملة', currency),
    h('label', {}, 'المبلغ', h('input', { name: 'amount', inputmode: 'decimal', required: true })),
    h('label', {}, 'استرداد من', sale),
    h('button', { type: 'submit' }, 'تسجيل'),
  );
  form.addEventListener('submit', (ev) => {
    ev.preventDefault();
    const t = field(form, 'type') as MovementType;
    const rule = canRecord(t, { offline: ctx.offline() });
    const amountMinor = toMinor(field(form, 'amount'));
    const refundOf = field(form, 'refundOf');
    const original = movements.find((m) => m.id === refundOf);
    const cur = t === 'refund' && original ? original.currency : field(form, 'currency');
    if (!rule.allowed) message.textContent = rule.messageAr ?? '';
    else if (!amountMinor) message.textContent = 'أدخل مبلغاً صحيحاً.';
    else if (
      t === 'refund' &&
      (!original || BigInt(amountMinor) > refundRemaining(original, movements))
    )
      message.textContent = 'مبلغ الاسترداد أكبر من المتبقي من عملية البيع.';
    else {
      const movementId = uuid();
      lastReceiptId = movementId;
      // Sales and refunds are queued (they may sync later); everything else is online-only.
      const send = OFFLINE_MOVEMENT_TYPES.includes(t)
        ? (c: Command) => ctx.submit(c)
        : (c: Command) => sendNow(ctx, c);
      void send({
        ...ctx.envelope(),
        type: 'cash.move',
        payload: {
          movementId,
          sessionId: open.id,
          type: t,
          currency: cur as (typeof CURRENCIES)[number],
          amountMinor,
          rateUsed: open.rates[cur] ?? '1',
          ...(t === 'refund' ? { refundOf } : {}),
        },
      });
    }
  });
  const receipt = movements.find((m) => m.id === lastReceiptId);
  section.append(
    ...kids(
      h(
        'p',
        {},
        `أسعار الصرف (آخر مزامنة): ${Object.entries(open.rates)
          .map(([c, r]) => `${c} ${r}`)
          .join(' · ')}`,
      ),
      offline ? h('p', { class: 'note' }, 'دون اتصال: البيع والاسترداد فقط.') : undefined,
      form,
      message,
      receipt
        ? h('div', { class: 'receipt', 'data-testid': 'receipt' }, receiptLines(receipt).join('\n'))
        : undefined,
      h('p', { 'data-testid': 'cash-totals' }, totals(movements).join(' | ')),
      h(
        'button',
        {
          type: 'button',
          disabled: offline,
          onclick: () =>
            void sendNow(ctx, {
              ...ctx.envelope(),
              type: 'cash.close',
              payload: { sessionId: open.id },
            }),
        },
        'إغلاق الصندوق',
      ),
    ),
  );
  return section;
}
