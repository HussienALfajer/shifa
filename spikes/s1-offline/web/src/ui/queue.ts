// Queue screen: walk-in form, printable ticket (provisional number + device id, real number once
// synced: SCH-32), status buttons.
import type { TicketRow } from '../engine.ts';
import type { Ctx } from './context.ts';
import { clinicToday, field, h, uuid } from './dom.ts';

const STATUS_AR: Record<string, string> = {
  waiting: 'ينتظر',
  called: 'نودي',
  in_service: 'عند الطبيب',
  done: 'انتهى',
  no_show: 'لم يحضر',
};

/** Next provisional number on this device: above every number it has seen for the shift. */
function nextProvisional(ctx: Ctx, practitionerId: string, shiftDate: string): number {
  const key = `s1-prov:${ctx.session.deviceId}:${practitionerId}:${shiftDate}`;
  const seen = ctx.today.tickets
    .filter((t) => t.practitionerId === practitionerId && t.shiftDate === shiftDate)
    .map((t) =>
      Math.max(t.realNumber ?? 0, t.deviceId === ctx.session.deviceId ? t.provisionalNumber : 0),
    );
  const stored = Number(localStorage.getItem(key) ?? '0');
  const next = Math.max(stored, ...seen, 0) + 1;
  localStorage.setItem(key, String(next));
  return next;
}

export function ticketCard(ctx: Ctx, t: TicketRow): HTMLElement {
  const practitioner =
    ctx.session.practitioners.find((p) => p.id === t.practitionerId)?.label ?? '';
  return h(
    'div',
    { class: 'ticket', 'data-testid': 'ticket-card' },
    h('div', {}, `${practitioner} — ${t.shiftDate}`),
    h(
      'div',
      {},
      'الرقم المؤقت: ',
      h('span', { class: 'num', 'data-testid': 'provisional' }, String(t.provisionalNumber)),
    ),
    h('div', {}, `الجهاز: ${t.deviceId}`),
    t.realNumber === undefined
      ? h('div', { class: 'note' }, 'الرقم النهائي بعد المزامنة')
      : h(
          'div',
          {},
          'الرقم النهائي: ',
          h('strong', { 'data-testid': 'real' }, String(t.realNumber)),
        ),
  );
}

export function queueSection(ctx: Ctx): HTMLElement {
  const form = h('form', { 'data-testid': 'walkin-form' }) as HTMLFormElement;
  const practitioners = h('select', { name: 'practitioner' });
  for (const p of ctx.session.practitioners)
    practitioners.append(h('option', { value: p.id }, p.label));
  form.append(
    h('label', {}, 'الطبيب', practitioners),
    h(
      'label',
      {},
      'اسم المراجع (اصطناعي)',
      h('input', { name: 'label', required: true, maxlength: '40' }),
    ),
    h('button', { type: 'submit' }, 'تسجيل مراجع'),
  );
  let printed: TicketRow | undefined;
  form.addEventListener('submit', (ev) => {
    ev.preventDefault();
    const practitionerId = field(form, 'practitioner');
    const shiftDate = clinicToday();
    const ticketId = uuid();
    const provisionalNumber = nextProvisional(ctx, practitionerId, shiftDate);
    printed = {
      id: ticketId,
      practitionerId,
      shiftDate,
      provisionalNumber,
      deviceId: ctx.session.deviceId,
      status: 'waiting',
      walkInLabel: field(form, 'label'),
    };
    form.reset();
    void ctx.submit({
      ...ctx.envelope(),
      type: 'ticket.issue',
      payload: {
        ticketId,
        practitionerId,
        shiftDate,
        provisionalNumber,
        walkInLabel: printed.walkInLabel,
      },
    });
  });

  const rows = ctx.today.tickets.map((t) => {
    const buttons = (['called', 'in_service', 'done', 'no_show'] as const).map((status) =>
      h(
        'button',
        {
          type: 'button',
          'data-testid': `status-${status}`,
          onclick: () =>
            void ctx.submit({
              ...ctx.envelope(),
              type: 'ticket.status',
              payload: { ticketId: t.id, status },
            }),
        },
        STATUS_AR[status] ?? status,
      ),
    );
    return h(
      'tr',
      { 'data-testid': 'ticket-row', 'data-ticket': t.id },
      h('td', {}, t.realNumber === undefined ? '—' : String(t.realNumber)),
      h('td', {}, `${String(t.provisionalNumber)} (${t.deviceId})`),
      h('td', {}, t.walkInLabel),
      h('td', { 'data-testid': 'ticket-status' }, STATUS_AR[t.status] ?? t.status),
      h('td', {}, ...buttons),
    );
  });
  const last =
    printed ?? ctx.today.tickets.filter((t) => t.deviceId === ctx.session.deviceId).at(-1);
  return h(
    'section',
    { 'data-testid': 'queue' },
    h('h2', {}, 'الدور'),
    form,
    last ? ticketCard(ctx, ctx.today.tickets.find((t) => t.id === last.id) ?? last) : undefined,
    h(
      'table',
      {},
      h(
        'thead',
        {},
        h(
          'tr',
          {},
          ...['النهائي', 'المؤقت (الجهاز)', 'المراجع', 'الحالة', ''].map((x) => h('th', {}, x)),
        ),
      ),
      h('tbody', {}, ...rows),
    ),
  );
}
