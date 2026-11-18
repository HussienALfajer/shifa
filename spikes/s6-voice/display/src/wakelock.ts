// Wake Lock (VOX-17): a screen lock on start and again whenever the page becomes visible (the
// browser drops it when the page is hidden). Failures are shown, never fatal.
import { logEvent } from './log.ts';

export interface WakeLockState {
  requests: number;
  held: boolean;
  error: string | null;
}

export function startWakeLock(onChange: () => void): WakeLockState {
  const state: WakeLockState = { requests: 0, held: false, error: null };
  const request = async () => {
    if (!('wakeLock' in navigator)) {
      state.error = 'unsupported';
      onChange();
      return;
    }
    state.requests += 1;
    try {
      const sentinel = await navigator.wakeLock.request('screen');
      state.held = true;
      state.error = null;
      sentinel.addEventListener('release', () => {
        state.held = false;
        logEvent('wakelock-released');
        onChange();
      });
      logEvent('wakelock', { ok: true });
    } catch (error) {
      state.held = false;
      state.error = error instanceof DOMException ? error.name : 'error';
      logEvent('wakelock', { ok: false, error: state.error });
    }
    onChange();
  };
  void request();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && !state.held) void request();
  });
  return state;
}
