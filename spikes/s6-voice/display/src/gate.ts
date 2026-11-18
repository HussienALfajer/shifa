// The autoplay gate (VOX-17): the page creates its AudioContext at load. Under a browser policy
// that needs a gesture the context stays suspended, and "اضغط لتفعيل الصوت" covers the screen
// until one tap resumes it; every later call plays with no tap. With the kiosk setting
// (--autoplay-policy=no-user-gesture-required) the context runs at once and the gate never shows.
import { logEvent } from './log.ts';

export function startGate(ctx: AudioContext, onChange: () => void): { shown: () => boolean } {
  const button = document.querySelector<HTMLButtonElement>('#gate');
  let shown = ctx.state !== 'running';
  const render = () => {
    if (button) button.hidden = !shown;
  };
  const update = () => {
    const wasShown = shown;
    shown = ctx.state !== 'running';
    render();
    if (wasShown !== shown) logEvent(shown ? 'gate-shown' : 'gate-cleared');
    onChange();
  };
  ctx.addEventListener('statechange', update);
  button?.addEventListener('click', () => {
    void ctx.resume().then(update);
  });
  if (shown) logEvent('gate-shown');
  render();
  // Allowed without a gesture under the kiosk setting; stays pending otherwise.
  void ctx.resume().then(update);
  return { shown: () => shown };
}
