// The owner's side of support access in clinic web (slice A-02-10; board `A02cSettings`, states
// `banner`, `endAsk`, `ended`, `logEmpty`; contract rows "owner's support banner and log" and
// "Owner ends support"; criteria 13, 26): GET /clinic/support-grants for an owner only (never in a
// support session, which the server refuses), each open grant as the warning banner above every
// page with its reason and time left, «إنهاء الدخول» asked first → POST …/:id/end → banner gone,
// «أنهيت دخول الدعم»; 409 `support_ended` reads again. «سجل دخول الدعم» on the settings page.
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  Button,
  Card,
  PageBanner,
  SkeletonGroup,
  SkeletonText,
} from '@shifa/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { isOwner, useProfile, useSignedIn } from '../account/data.ts';
import { LoadFailed } from '../account/load-failed.tsx';
import { SupportLog } from '../admin/support-log.tsx';
import { errorFacts } from '../client.ts';
import { isSupport } from '../guard.ts';
import { useShell } from '../providers.tsx';
import type { SessionView } from '../session.ts';
import { useText } from '../text.ts';
import { useTimeLeft } from './time-left.ts';

interface ClinicGrants {
  now: string;
  open: { id: string; adminName: string; reason: string; expiresAt: string }[];
  grants: Parameters<typeof SupportLog>[0]['grants'][number][];
}

export const supportGrantsKey = (tenantId: string) =>
  ['clinic', tenantId, 'support-grants'] as const;

const isGrants = (d: unknown): d is ClinicGrants => {
  const x = d as Partial<ClinicGrants> | null;
  return typeof x?.now === 'string' && Array.isArray(x.open) && Array.isArray(x.grants);
};

/** Read on each page an owner opens (no poll: a request is activity, criterion 26 is per page). */
export function useClinicSupportGrants(session: SessionView | undefined) {
  const { shell } = useShell();
  const tenantId = session?.tenantId ?? '';
  return useQuery({
    queryKey: supportGrantsKey(tenantId),
    queryFn: async (): Promise<ClinicGrants | null> => {
      const { data, response } = await shell.api.GET('/clinic/support-grants');
      if (response.status === 403) return null;
      if (!data) throw new Error(`GET /clinic/support-grants answered ${String(response.status)}`);
      return isGrants(data) ? data : null;
    },
    enabled: tenantId !== '' && isOwner(session) && !isSupport(session),
    staleTime: 0,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
}

function OwnerBanner({
  grant,
  now,
  receivedAt,
  onAsk,
}: {
  grant: ClinicGrants['open'][number];
  now: string;
  receivedAt: number;
  onAsk: () => void;
}) {
  const text = useText();
  const left = useTimeLeft(grant.expiresAt, now, receivedAt);
  // Run out on this page's clock: no longer open, though the next read has not said so yet.
  if (left.minutes === 0) return null;
  return (
    <PageBanner
      tone="warning"
      icon="eye"
      title={text('ownerSupportTitle', { name: grant.adminName })}
      aria-label={text('supportRegion')}
      action={
        <Button size="sm" variant="secondary" onClick={onAsk}>
          {text('supportEndAction')}
        </Button>
      }
    >
      {text('ownerSupportText', {
        reason: grant.reason,
        time: left.until,
        minutes: left.minutes,
      })}
    </PageBanner>
  );
}

/** The banners of the open grants, and the question before ending one. */
export function OwnerSupportBanners({ onEnded }: { onEnded: () => void }) {
  const text = useText();
  const { shell } = useShell();
  const queryClient = useQueryClient();
  const session = useSignedIn();
  const grants = useClinicSupportGrants(session);
  const [asked, setAsked] = useState<string | null>(null);
  const [failure, setFailure] = useState('');
  const data = grants.data;
  if (!data || data.open.length === 0 || !session?.tenantId) return null;
  const key = supportGrantsKey(session.tenantId);

  async function end(id: string) {
    setFailure('');
    const { data: ended, error } = await shell.api.POST('/clinic/support-grants/{id}/end', {
      params: { path: { id } },
    });
    if (ended || errorFacts(error).code === 'support_ended') {
      await queryClient.invalidateQueries({ queryKey: key });
      setAsked(null);
      if (ended) onEnded();
      return;
    }
    setFailure(text('ownerSupportEndFailed'));
    throw new Error('the support access was not ended');
  }

  return (
    <>
      {data.open.map((g) => (
        <OwnerBanner
          key={g.id}
          grant={g}
          now={data.now}
          receivedAt={grants.dataUpdatedAt}
          onAsk={() => {
            setFailure('');
            setAsked(g.id);
          }}
        />
      ))}
      <AlertDialog
        open={asked !== null}
        onOpenChange={(open) => {
          if (!open) setAsked(null);
        }}
      >
        {asked !== null && (
          <AlertDialogContent
            tone="danger"
            title={text('supportEndAskTitle')}
            description={text('ownerSupportEndAsk')}
          >
            <AlertDialogCancel>{text('back')}</AlertDialogCancel>
            <AlertDialogAction errorText={failure} onAction={() => end(asked)}>
              {text('supportEndAction')}
            </AlertDialogAction>
          </AlertDialogContent>
        )}
      </AlertDialog>
    </>
  );
}

/** «سجل دخول الدعم» on the settings page: every grant, newest first. */
export function OwnerSupportLog({ session }: { session: SessionView }) {
  const text = useText();
  const { data, isError, isPending, refetch } = useClinicSupportGrants(session);
  const { data: profile } = useProfile(session.userId);
  // Not an owner (403) or a support session: no card (contract row `banner` … `logEmpty`).
  if (isSupport(session) || data === null) return null;
  return (
    <Card className="gap-4 p-(--shifa-card-padding)">
      <div className="flex flex-col gap-1">
        <h2 className="m-0 text-heading-sm leading-heading font-semibold">
          {text('supportLogTitle')}
        </h2>
        <p className="m-0 text-data leading-body text-text-muted">{text('ownerLogText')}</p>
      </div>
      {isError ? (
        <LoadFailed retry={refetch} />
      ) : isPending ? (
        <SkeletonGroup label={text('ownerLogLoading')}>
          <SkeletonText lines={3} />
        </SkeletonGroup>
      ) : (
        <SupportLog
          grants={data.grants}
          viewer="owner"
          {...(profile ? { selfName: profile.name } : {})}
        />
      )}
    </Card>
  );
}
