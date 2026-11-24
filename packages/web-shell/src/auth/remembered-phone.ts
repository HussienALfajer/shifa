// The last phone that signed in to clinic web on this device (slice A-01-07, improvement i): a
// convenience, never relied on. Forgotten after 14 days, on «ليس رقمك؟» and on every deliberate
// sign-out, before its request is sent, whatever the server answers (the person is leaving this
// computer; checkpoint 5 security review L2). Never kept on admin web, nor for a super admin who
// signs in on clinic web (checkpoint 2 security review L2, checkpoint 5 L2).
const REMEMBERED = 'shifa.signIn.phone';
const REMEMBERED_AT = 'shifa.signIn.phoneAt';
const REMEMBER_FOR_MS = 14 * 24 * 60 * 60_000;

export function writeRememberedPhone(phone: string | null): void {
  try {
    if (phone === null) {
      localStorage.removeItem(REMEMBERED);
      localStorage.removeItem(REMEMBERED_AT);
    } else {
      localStorage.setItem(REMEMBERED, phone);
      localStorage.setItem(REMEMBERED_AT, String(Date.now()));
    }
  } catch {
    // Storage blocked: nothing is remembered.
  }
}

export function forgetRememberedPhone(): void {
  writeRememberedPhone(null);
}

export function readRememberedPhone(): string {
  try {
    const phone = localStorage.getItem(REMEMBERED) ?? '';
    const at = Number(localStorage.getItem(REMEMBERED_AT));
    if (phone !== '' && Number.isFinite(at) && at > 0 && Date.now() - at > REMEMBER_FOR_MS) {
      forgetRememberedPhone();
      return '';
    }
    return phone;
  } catch {
    return '';
  }
}
