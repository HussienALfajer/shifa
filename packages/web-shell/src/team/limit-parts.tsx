// The doctors' limit in the team forms (slice A-02-10; board `A02cLimits`, states `addAtLimit`,
// `add409`, `reactivate`; contract rows "Team form · limit before sending" and "after sending"):
// the limit from the frame's capabilities, the warning while it is full, and the words of a 409
// `limit_reached` («لم يُحفظ شيء» naming the limit). Nothing is written on a refusal.
import { Callout } from '@shifa/ui';
import { keyWord } from '../admin/clinic-data.ts';
import { isFull, type LimitUse, PRACTITIONERS, useLimit } from '../capabilities.ts';
import { useText } from '../text.ts';

export function useDoctorLimit(tenantId: string): LimitUse | undefined {
  return useLimit(tenantId, PRACTITIONERS);
}

/** The sentence naming a limit and its use, «وصلت العيادة إلى حد الأطباء في خطتها (35 من 35)…». */
export function useLimitSentence(): (l: { key: string; limit: number; used: number }) => string {
  const text = useText();
  return (l) =>
    // A 409 without its `limitReached` (an older server): no numbers to name.
    l.key === ''
      ? text('limitSomeFull')
      : l.key === PRACTITIONERS
        ? text('limitDoctorsFull', { used: l.used, limit: l.limit })
        : l.key === 'limits.branches'
          ? text('limitBranchesFull', { used: l.used, limit: l.limit })
          : text('limitOtherFull', { item: keyWord(text, l.key), used: l.used, limit: l.limit });
}

/** Before sending: the doctor role cannot be added while the limit is full. */
export function DoctorsFullCallout({ limit }: { limit: LimitUse | undefined }) {
  const text = useText();
  const sentence = useLimitSentence();
  if (!isFull(limit)) return null;
  return (
    <Callout tone="warning">
      {`${sentence({ key: limit.key, limit: limit.limit, used: limit.used })} ${text('limitOthersAllowed')}`}
    </Callout>
  );
}

/** After sending: a 409 `limit_reached`, nothing saved. */
export function LimitRefused({
  reached,
}: {
  reached: { key: string; limit: number; used: number } | null;
}) {
  const text = useText();
  const sentence = useLimitSentence();
  if (reached === null) return null;
  return (
    <Callout data-testid="limit-refused" tone="danger" title={text('limitNotSaved')}>
      {sentence(reached)}
    </Callout>
  );
}
