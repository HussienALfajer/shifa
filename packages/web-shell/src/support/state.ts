// What clinic web knows about a support session's end (slice A-02-10; A-02 criterion 12, contract
// rows `endedExpiry`, `endedOwner`, `endedSelf`): the facts of the last 401 `support_ended` (who
// ended the grant, when, the owner's name), or that this tab ended it, or that a hand-off was
// refused. Kept in memory only: an owner's name never goes into a URL, storage or a log. Also the
// one signal of a write refused with 403 `support_read_only`, which the frame names.
import type { SupportEndedBy } from '@shifa/contracts';

export type SupportEnd =
  | { kind: 'ended'; endedBy: SupportEndedBy; endedAt: number; ownerName: string | null }
  | { kind: 'self'; endedAt: number }
  | { kind: 'link' };

let last: SupportEnd | null = null;

export function rememberSupportEnd(end: SupportEnd): void {
  last = end;
}

/** The end last seen on this page, or null (the ended page then says it plainly). */
export function supportEnd(): SupportEnd | null {
  return last;
}

/** The `supportEnded` of an error body, when it has the contract's shape. */
export function supportEndOf(body: unknown): SupportEnd | null {
  const ended = (body as { error?: { supportEnded?: unknown } } | null)?.error?.supportEnded as
    | { endedBy?: unknown; endedAt?: unknown; ownerName?: unknown }
    | undefined;
  if (!ended) return null;
  const { endedBy, endedAt, ownerName } = ended;
  if (endedBy !== 'admin' && endedBy !== 'owner' && endedBy !== 'expiry') return null;
  const at = typeof endedAt === 'string' ? Date.parse(endedAt) : Number.NaN;
  return {
    kind: 'ended',
    endedBy,
    endedAt: Number.isFinite(at) ? at : Date.now(),
    ownerName: typeof ownerName === 'string' ? ownerName : null,
  };
}
