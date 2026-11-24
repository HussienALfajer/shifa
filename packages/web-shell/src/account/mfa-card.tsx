// «التحقق بخطوتين» on My account (slice A-01-10 checkpoint 2; prototype `Account10`; A-01a
// criteria 11, 12a). GET /auth/mfa: enrolled («مفعّل» since when) with the recovery codes left
// — information at three or more, a warning at one or two, danger at none, and the renewal button
// primary when low — or not enrolled («غير مفعّل», optional for staff) with the enrolment. An
// enrolled person moves TOTP to a new phone here (checkpoint 3, OD-98).
import { Badge, Button, Callout, Card, SkeletonGroup, SkeletonText } from '@shifa/ui';
import { useState } from 'react';
import { dayDate } from '../auth/dates.ts';
import { useText } from '../text.ts';
import type { Tell } from './account-page.tsx';
import { LOW_CODES } from './app-frame.tsx';
import { CodesDialog } from './codes-dialog.tsx';
import { isOwner, useMfaStatus, useSignedIn } from './data.ts';
import { LoadFailed } from './load-failed.tsx';
import { ReenrolDialog } from './reenrol-dialog.tsx';

const TOTAL = 10;

export function MfaCard({ tell }: { tell: Tell }) {
  const text = useText();
  const session = useSignedIn();
  const { data: status, isError, refetch } = useMfaStatus(session?.userId ?? '');
  const [dialog, setDialog] = useState<'renew' | 'enrol' | 'move' | null>(null);
  const left = status?.recoveryCodesLeft ?? null;
  const low = left !== null && left <= LOW_CODES;
  const openDialog = (kind: 'renew' | 'enrol' | 'move') => {
    tell(null);
    setDialog(kind);
  };
  return (
    <div data-testid="mfa-card" className="contents">
      <Card className="gap-4 p-(--shifa-card-padding)">
        <div className="flex items-center gap-2">
          <h2 className="m-0 flex-1 text-heading-sm leading-heading font-semibold">
            {text('mfaCardTitle')}
          </h2>
          {status && (
            <Badge tone={status.enrolled ? 'success' : 'neutral'}>
              {text(status.enrolled ? 'mfaOn' : 'mfaOff')}
            </Badge>
          )}
        </div>
        {!status && isError && <LoadFailed retry={refetch} />}
        {!status && !isError && (
          <SkeletonGroup label={text('mfaLoading')}>
            <SkeletonText lines={2} />
          </SkeletonGroup>
        )}
        {status?.enrolled === true && (
          <>
            {status.enrolledAt !== null && (
              <p className="m-0 text-data leading-body text-text-muted">
                {text(isOwner(session) ? 'mfaSinceRequired' : 'mfaSince', {
                  date: dayDate(Date.parse(status.enrolledAt)),
                })}
              </p>
            )}
            {left !== null && (
              <Callout
                data-testid="codes-left"
                tone={left === 0 ? 'danger' : low ? 'warning' : 'info'}
                icon={low ? 'warning' : 'file-text'}
                title={text('codesLeftLine', { count: left, total: TOTAL })}
              >
                {text(
                  left === 0 ? 'codesLeftNoneText' : low ? 'codesLeftLowText' : 'codesLeftInfo',
                )}
              </Callout>
            )}
            <div className="flex flex-wrap gap-2">
              <Button
                variant={low ? 'primary' : 'secondary'}
                startIcon="file-text"
                onClick={() => {
                  openDialog('renew');
                }}
              >
                {text('codesRenew')}
              </Button>
              <Button
                variant="ghost"
                startIcon="phone"
                onClick={() => {
                  openDialog('move');
                }}
              >
                {text('reenrolOpen')}
              </Button>
            </div>
          </>
        )}
        {status?.enrolled === false && (
          <>
            <p className="m-0 text-data leading-body text-text-muted">{text('mfaOffText')}</p>
            <div>
              <Button
                variant="primary"
                startIcon="phone"
                onClick={() => {
                  openDialog('enrol');
                }}
              >
                {text('mfaEnrolOpen')}
              </Button>
            </div>
          </>
        )}
      </Card>
      {dialog === 'move' && (
        <ReenrolDialog
          tell={tell}
          onClose={() => {
            setDialog(null);
          }}
        />
      )}
      {(dialog === 'renew' || dialog === 'enrol') && (
        <CodesDialog
          kind={dialog}
          tell={tell}
          onClose={() => {
            setDialog(null);
          }}
        />
      )}
    </div>
  );
}
