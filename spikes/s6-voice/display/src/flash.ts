// The visual flash (VOX-14 shape, VOX-18): number and room full-screen for ~8 s on every call.
import { logEvent } from './log.ts';

export const FLASH_MS = 8_000;
let timer: ReturnType<typeof setTimeout> | undefined;

export function flash(callId: string, number: number, room: number): void {
  const el = document.querySelector<HTMLElement>('[data-testid="flash"]');
  if (!el) return;
  const numberEl = el.querySelector('.flash-number');
  const roomEl = el.querySelector('.flash-room');
  if (numberEl) numberEl.textContent = String(number);
  if (roomEl) roomEl.textContent = `العيادة ${String(room)}`;
  el.hidden = false;
  clearTimeout(timer);
  timer = setTimeout(() => {
    el.hidden = true;
  }, FLASH_MS);
  logEvent('flash', { callId, number, room, ms: FLASH_MS });
}
