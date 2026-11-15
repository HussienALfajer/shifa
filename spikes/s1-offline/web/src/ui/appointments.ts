// Appointment booking; a double booking comes back as a conflict in the events list (SCH-14).
import type { Ctx } from './context.ts';
import { clinicToday, field, h, uuid } from './dom.ts';

const time = (iso: string) =>
  new Intl.DateTimeFormat('ar-SY', {
    timeZone: 'Asia/Damascus',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));

export function appointmentsSection(ctx: Ctx): HTMLElement {
  const form = h('form', { 'data-testid': 'booking-form' }) as HTMLFormElement;
  const practitioners = h('select', { name: 'practitioner' });
  for (const p of ctx.session.practitioners)
    practitioners.append(h('option', { value: p.id }, p.label));
  form.append(
    h('label', {}, 'الطبيب', practitioners),
    h(
      'label',
      {},
      'الوقت',
      h('input', { name: 'start', type: 'time', required: true, value: '10:00' }),
    ),
    h(
      'label',
      {},
      'المدة (دقيقة)',
      h('input', { name: 'minutes', type: 'number', min: '5', value: '30' }),
    ),
    h('button', { type: 'submit' }, 'حجز'),
  );
  form.addEventListener('submit', (ev) => {
    ev.preventDefault();
    const start = new Date(`${clinicToday()}T${field(form, 'start')}:00+03:00`);
    const end = new Date(start.getTime() + Number(field(form, 'minutes') || '30') * 60_000);
    void ctx.submit({
      ...ctx.envelope(),
      type: 'appointment.book',
      payload: {
        appointmentId: uuid(),
        practitionerId: field(form, 'practitioner'),
        start: start.toISOString(),
        end: end.toISOString(),
      },
    });
  });
  const label = (id: string) => ctx.session.practitioners.find((p) => p.id === id)?.label ?? '';
  const rows = ctx.today.appointments.map((a) =>
    h(
      'tr',
      { 'data-testid': 'appointment-row' },
      h('td', {}, label(a.practitionerId)),
      h('td', {}, `${time(a.start)} – ${time(a.end)}`),
      h('td', {}, a.status === 'cancelled' ? 'ملغى' : 'محجوز'),
      h(
        'td',
        {},
        a.status === 'cancelled'
          ? undefined
          : h(
              'button',
              {
                type: 'button',
                onclick: () =>
                  void ctx.submit({
                    ...ctx.envelope(),
                    type: 'appointment.cancel',
                    payload: { appointmentId: a.id },
                  }),
              },
              'إلغاء',
            ),
      ),
    ),
  );
  return h(
    'section',
    { 'data-testid': 'appointments' },
    h('h2', {}, 'المواعيد'),
    form,
    h('table', {}, h('tbody', {}, ...rows)),
  );
}
