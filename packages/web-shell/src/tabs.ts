// A sign-out told to the app's other tabs (slice A-01-07 checkpoint 4): the tab that signed out
// posts `{ type: 'signed-out', reason }` on the channel the idle limit shares; a tab that hears it
// asks the server itself and goes to sign-in only when its session is really gone, so a message
// any page of this origin could post never signs anyone out by itself.
import type { SignInReason } from './guard.ts';

export const TAB_CHANNEL = 'shifa-session';

/** Reasons another tab may name; anything else is read as a plain sign-out. */
const REASONS = new Set<SignInReason>(['signed_out', 'idle', 'absolute']);

export interface SignedOutMessage {
  type: 'signed-out';
  reason: SignInReason;
}

const channel = () =>
  typeof BroadcastChannel === 'function' ? new BroadcastChannel(TAB_CHANNEL) : undefined;

/** Tells the other tabs that this one signed out. */
export function announceSignOut(reason: SignInReason): void {
  const out = channel();
  if (!out) return;
  const message: SignedOutMessage = { type: 'signed-out', reason };
  out.postMessage(message);
  out.close();
}

/** Calls `listener` with the (checked) reason of another tab's sign-out; returns the unsubscribe. */
export function onOtherTabSignOut(listener: (reason: SignInReason) => void): () => void {
  const input = channel();
  if (!input) return () => undefined;
  const onMessage = (event: MessageEvent<unknown>) => {
    const data = event.data as { type?: unknown; reason?: unknown } | null;
    if (typeof data !== 'object' || data?.type !== 'signed-out') return;
    const reason = typeof data.reason === 'string' ? data.reason : '';
    listener(REASONS.has(reason) ? reason : 'signed_out');
  };
  input.addEventListener('message', onMessage);
  return () => {
    input.removeEventListener('message', onMessage);
    input.close();
  };
}
