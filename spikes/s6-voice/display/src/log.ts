// The in-page log: every event is kept for the test hook and shown in the page; `played`
// acknowledgements also go to the console (no server in the spike).

export interface DisplayEvent {
  type: string;
  at: number;
  [key: string]: unknown;
}

export const events: DisplayEvent[] = [];
const SHOWN = 30;

export function logEvent(type: string, detail: Record<string, unknown> = {}): void {
  const event: DisplayEvent = { type, at: Math.round(performance.now()), ...detail };
  events.push(event);
  if (type === 'played') console.info('played', JSON.stringify(detail));
  const list = document.getElementById('log');
  if (!list) return;
  const item = document.createElement('li');
  item.textContent = `${String(event.at)} ms ${type} ${JSON.stringify(detail)}`;
  list.prepend(item);
  while (list.children.length > SHOWN) list.lastElementChild?.remove();
}
