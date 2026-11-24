// The invitation a signed-out person is answering while they sign in (slice A-01-08 checkpoint
// 2): «الدخول للرد على الدعوة» holds the link's token here, in this tab's memory only (never a URL,
// storage, the query cache or a log), and the router sends the finished session back to /setup,
// where the page takes it. A reload forgets it; the person opens the link again. It lasts 15
// minutes, and the router forgets it when the session goes elsewhere (admin web, a sign-out), so
// the next person on the tab is not shown it (review finding 3).
const LIFETIME_MS = 15 * 60_000;

let held: { token: string; at: number } | null = null;

export function holdInvitation(token: string, now = Date.now()): void {
  held = { token, at: now };
}

export function hasHeldInvitation(now = Date.now()): boolean {
  if (held !== null && now - held.at > LIFETIME_MS) held = null;
  return held !== null;
}

/** The held token, once: the page that shows it forgets it here. */
export function takeHeldInvitation(now = Date.now()): string | null {
  const token = hasHeldInvitation(now) ? (held?.token ?? null) : null;
  held = null;
  return token;
}

export function forgetHeldInvitation(): void {
  held = null;
}
