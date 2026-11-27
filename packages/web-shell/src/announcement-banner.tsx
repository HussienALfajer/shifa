// The announcement banner above every page of clinic web (slice A-02-10; board `A02cAnnouncements`;
// contract rows "Every page · announcement banner" and "Announcement · hide"; criterion 15): GET
// /me/announcements for every member (the support principal too), shown as PageBanner in the
// server's order (warning first, then newest), «1 من 3» with previous and next; «إخفاء الإعلان»
// sends its version → the next one or none, hidden on the person's other devices at their next
// read; 404 (ended meanwhile) drops it; 403 `support_read_only` keeps it (the frame names it).
// Nothing is shown offline: the read is not kept past the page.
import { PageBanner } from '@shifa/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useSignedIn } from './account/data.ts';
import { useShell } from './providers.tsx';
import { useText } from './text.ts';

interface MyAnnouncement {
  id: string;
  version: number;
  level: 'info' | 'warning';
  body: string;
}

const isAnnouncement = (a: unknown): a is MyAnnouncement => {
  const x = a as Partial<MyAnnouncement> | null;
  return (
    typeof x?.id === 'string' &&
    typeof x.version === 'number' &&
    (x.level === 'info' || x.level === 'warning') &&
    typeof x.body === 'string'
  );
};

export const myAnnouncementsKey = (tenantId: string, userId: string) =>
  ['clinic', tenantId, 'announcements', userId] as const;

export function AnnouncementBanner() {
  const text = useText();
  const { shell } = useShell();
  const queryClient = useQueryClient();
  const session = useSignedIn();
  const tenantId = session?.tenantId ?? '';
  const userId = session?.userId ?? '';
  const key = myAnnouncementsKey(tenantId, userId);
  const { data } = useQuery({
    queryKey: key,
    queryFn: async (): Promise<MyAnnouncement[]> => {
      const { data: body } = await shell.api.GET('/me/announcements');
      const list = (body as { announcements?: unknown } | undefined)?.announcements;
      return Array.isArray(list) ? list.filter(isAnnouncement) : [];
    },
    enabled: tenantId !== '' && userId !== '',
    staleTime: 60_000,
    gcTime: 0,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  const [index, setIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const list = data ?? [];
  if (list.length === 0) return null;
  const shownIndex = Math.min(index, list.length - 1);
  const shown = list[shownIndex];
  if (!shown) return null;

  const drop = (id: string) => {
    queryClient.setQueryData<MyAnnouncement[]>(key, (old) => old?.filter((a) => a.id !== id));
  };

  async function hide(a: MyAnnouncement) {
    if (busy) return;
    setBusy(true);
    try {
      const { response } = await shell.api.POST('/me/announcements/{id}/dismiss', {
        params: { path: { id: a.id } },
        body: { version: a.version },
      });
      if (response.ok || response.status === 404) drop(a.id);
    } catch {
      // No answer: it stays, and can be hidden again.
    } finally {
      setBusy(false);
    }
  }

  const title = text(shown.level === 'warning' ? 'annLevelWarningTitle' : 'annLevelInfoTitle');
  return (
    <PageBanner
      tone={shown.level}
      title={title}
      aria-label={text('annRegion')}
      onDismiss={() => void hide(shown)}
      dismissLabel={text('annHide')}
      {...(list.length > 1
        ? {
            pager: {
              index: shownIndex,
              count: list.length,
              onIndexChange: setIndex,
              previousLabel: text('annPrevious'),
              nextLabel: text('annNext'),
            },
          }
        : {})}
    >
      {shown.body}
    </PageBanner>
  );
}
