// The local control page (manual and emulator runs): posts a call over BroadcastChannel to the
// display page open in the same browser profile, as the receptionist's "التالي" would.
import type { Call } from './queue.ts';

const channel = new BroadcastChannel('s6-calls');
const form = document.querySelector<HTMLFormElement>('#call-form');
const sent = document.querySelector('#sent');

form?.addEventListener('submit', (event) => {
  event.preventDefault();
  const data = new FormData(form);
  const raw = data.get('name');
  const name = typeof raw === 'string' ? raw.trim() : '';
  const call: Call = {
    // randomUUID needs a secure context; the fallback keeps the page usable on a plain-HTTP host.
    callId:
      'randomUUID' in crypto
        ? crypto.randomUUID()
        : `${String(Date.now())}-${String(Math.random()).slice(2)}`,
    number: Number(data.get('number')),
    room: Number(data.get('room')),
    issuedAt: Date.now(),
    ...(name ? { nameClipId: name } : {}),
  };
  channel.postMessage(call);
  if (sent)
    sent.textContent = `أُرسل النداء ${String(call.number)} إلى العيادة ${String(call.room)}`;
});
