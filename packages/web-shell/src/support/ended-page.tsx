// «انتهى دخول الدعم» (slice A-02-10; board `A02cSupportSession`, states `endedExpiry`,
// `endedOwner`, `endedSelf`; A-02 criterion 12): the full page a support tab shows once its grant
// ended, with the cause from the 401 `support_ended` (`supportEnded`), this tab's own end, or a
// refused hand-off; «العودة إلى إدارة شفاء» closes the tab (admin web's tab opened it and is still
// there). Nothing of the clinic stays: the router cleared the cache before coming here.
import { Button, EmptyState } from '@shifa/ui';
import { useState } from 'react';
import { AuthLayout } from '../auth/auth-layout.tsx';
import { clockTime } from '../auth/lock.ts';
import { useText } from '../text.ts';
import { type SupportEnd, supportEnd } from './state.ts';

function useCause(end: SupportEnd | null): string {
  const text = useText();
  if (end === null) return text('supportEndedPlain');
  if (end.kind === 'link') return text('supportEndedLink');
  const time = clockTime(end.endedAt);
  if (end.kind === 'self') return text('supportEndedSelf', { time });
  if (end.endedBy === 'owner') {
    return text('supportEndedOwner', { name: end.ownerName ?? '', time });
  }
  if (end.endedBy === 'expiry') return text('supportEndedExpiry', { time });
  return text('supportEndedAdmin', { time });
}

export function SupportEndedView({ end }: { end: SupportEnd | null }) {
  const text = useText();
  const cause = useCause(end);
  const [stillOpen, setStillOpen] = useState(false);
  return (
    <AuthLayout>
      <div data-testid="support-ended" className="flex flex-col gap-4">
        <EmptyState
          size="page"
          icon="eye"
          headingLevel={1}
          title={text('supportSessionEndedTitle')}
          description={cause}
          actions={
            <Button
              variant="primary"
              onClick={() => {
                window.close();
                // A tab the browser will not close (not opened by a script): say where to go.
                setStillOpen(true);
              }}
            >
              {text('supportBackToAdmin')}
            </Button>
          }
        />
        {stillOpen && (
          <p className="m-0 text-center text-caption leading-body text-text-muted">
            {text('supportCloseTab')}
          </p>
        )}
      </div>
    </AuthLayout>
  );
}

export function SupportEndedPage() {
  const [end] = useState(supportEnd);
  return <SupportEndedView end={end} />;
}
