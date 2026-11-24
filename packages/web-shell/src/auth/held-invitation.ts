// The invitation a signed-out person is answering while they sign in (slice A-01-08 checkpoint
// 2): «الدخول للرد على الدعوة» holds the link's token here, in this tab's memory only (never a URL,
// storage, the query cache or a log), and the router sends the finished session back to /setup,
// where the page takes it. A reload forgets it; the person opens the link again.
let held: string | null = null;

export function holdInvitation(token: string): void {
  held = token;
}

export function hasHeldInvitation(): boolean {
  return held !== null;
}

/** The held token, once: the page that shows it forgets it here. */
export function takeHeldInvitation(): string | null {
  const token = held;
  held = null;
  return token;
}
