// The frame of clinic web's signed-in pages (slice A-01-10 checkpoint 2; prototype `Account10`,
// approved 2026-11-24): the top bar (the logo, the clinic, the recovery-codes badge when two or
// fewer are left — improvement b — and the person's avatar) and the navigation at the start of
// the line (الرئيسية, the owner's «إعدادات العيادة», حسابي, خروج). On a phone the navigation
// opens over the page from a menu button. The bar's clinic is the header switcher (A-01-08
// checkpoint 2, `switcher/clinic-switcher.tsx`); the owner's «الفريق» came with checkpoint 3
// (`team/`), «الفروع» with checkpoint 4 (`branches/`; not for a solo clinic, whose owner adds the
// second branch from the clinic's settings). A-02-10: above the bar, the support session's strip
// or the owner's support banners, then the announcement banner; the plan's capabilities read with
// the session; a support session names its clinic without a switcher and a refused write.
import type { CommonKey } from '@shifa/i18n';
import { Avatar, Badge, Button, Callout, cn, Icon, IconButton, type IconName } from '@shifa/ui';
import { Link } from '@tanstack/react-router';
import { type ReactNode, useState } from 'react';
import logoColour from '../../../../docs/brand/logo/shifa-logo-horizontal-color.svg';
import logoReverse from '../../../../docs/brand/logo/shifa-logo-horizontal-reverse.svg';
import { AnnouncementBanner } from '../announcement-banner.tsx';
import { useIsPhone } from '../auth/media.ts';
import { BRANCHES, useLimit } from '../capabilities.ts';
import { isSupport } from '../guard.ts';
import { OwnerSupportBanners } from '../support/owner-support.tsx';
import { ReadOnlyRefused, SupportSessionBanner } from '../support/support-banner.tsx';
import { ClinicSwitcher } from '../switcher/clinic-switcher.tsx';
import { useText } from '../text.ts';
import { useSignOut } from '../use-sign-out.ts';
import { isOwner, useActiveClinic, useMfaStatus, useProfile, useSignedIn } from './data.ts';

export const LOW_CODES = 2;

type Place = 'home' | 'account' | 'settings' | 'team' | 'branches';

/** The owner's places: a member has no item for them. */
const OWNER_ONLY: ReadonlySet<Place> = new Set(['team', 'branches', 'settings']);

const ITEMS: {
  place: Place;
  to: '/' | '/account' | '/settings' | '/team' | '/branches';
  icon: IconName;
  key: CommonKey;
}[] = [
  { place: 'home', to: '/', icon: 'house', key: 'navHome' },
  { place: 'team', to: '/team', icon: 'users', key: 'navTeam' },
  { place: 'branches', to: '/branches', icon: 'buildings', key: 'navBranches' },
  { place: 'settings', to: '/settings', icon: 'gear', key: 'navClinicSettings' },
  { place: 'account', to: '/account', icon: 'user', key: 'navAccount' },
];

const NAV_ITEM = cn(
  'flex h-(--shifa-size-control-md) items-center gap-3 rounded-control px-3 font-medium text-text-default no-underline',
  'hover:bg-selection-subtle focus-visible:shadow-focus focus-visible:outline-2 focus-visible:outline-border-focus',
  'aria-[current=page]:bg-selection-default aria-[current=page]:font-semibold',
);

function CodesBadge({ userId }: { userId: string }) {
  const text = useText();
  const { data } = useMfaStatus(userId);
  const left = data?.enrolled === true ? data.recoveryCodesLeft : null;
  if (left === null || left > LOW_CODES) return null;
  return <Badge tone="warning">{text('headerCodesLeft', { count: left })}</Badge>;
}

export function AppFrame({
  current,
  title,
  description,
  children,
}: {
  current: Place;
  title: string;
  description: string;
  children: ReactNode;
}) {
  const text = useText();
  const session = useSignedIn();
  const phone = useIsPhone();
  const [menu, setMenu] = useState(false);
  const signOut = useSignOut();
  const userId = session?.userId ?? '';
  const { data: profile } = useProfile(userId);
  const owner = isOwner(session);
  const support = isSupport(session);
  const clinic = useActiveClinic(session);
  // Read with the session on every page and kept for offline (A-02-10).
  const branchLimit = useLimit(session?.tenantId, BRANCHES);
  const [ownerEnded, setOwnerEnded] = useState(false);
  // Branch screens only once the clinic is known to have two or more branches; a support session
  // has no clinic of its own in GET /me/clinics, so the plan's count of active branches says it.
  const multiBranch = support ? (branchLimit?.used ?? 0) > 1 : clinic?.solo === false;
  const showNav = !phone || menu;
  // A support session has no account of its own to manage here: «حسابي» is absent (A-02-10).
  const shown = (place: Place) =>
    (!OWNER_ONLY.has(place) || owner) &&
    (place !== 'branches' || multiBranch) &&
    (place !== 'account' || !support);
  return (
    <div className="flex min-h-dvh flex-col bg-bg-app font-ui text-text-default">
      {session && support && <SupportSessionBanner session={session} />}
      {owner && !support && (
        <OwnerSupportBanners
          onEnded={() => {
            setOwnerEnded(true);
          }}
        />
      )}
      <AnnouncementBanner />
      <header className="flex h-(--shifa-size-row) shrink-0 items-center gap-3 border-b border-border-default bg-bg-surface px-4">
        {phone && (
          <IconButton
            icon="list"
            label={text('navMenu')}
            variant="ghost"
            aria-expanded={menu}
            onClick={() => {
              setMenu((m) => !m);
            }}
          />
        )}
        <img
          src={logoColour}
          alt={text('appName')}
          className="h-auto w-(--shifa-width-24) dark:hidden"
        />
        <img
          src={logoReverse}
          alt={text('appName')}
          className="hidden h-auto w-(--shifa-width-24) dark:block"
        />
        {session?.support ? (
          // No switching in a support session: the clinic it reads, named.
          <span
            className="inline-flex min-w-0 items-center gap-2 text-data font-medium"
            title={text('supportNoSwitch')}
          >
            <Icon name="eye" />
            <span className="truncate">{session.support.clinicName}</span>
          </span>
        ) : (
          session && <ClinicSwitcher session={session} />
        )}
        <span className="flex-1" />
        {session && <CodesBadge userId={userId} />}
        <Avatar name={profile?.name ?? ''} size="sm" />
      </header>
      <div className="relative flex min-h-0 flex-1">
        {showNav && (
          <nav
            aria-label={text('navLabel')}
            className={cn(
              'flex w-(--shifa-width-60) shrink-0 flex-col gap-1 border-e border-border-default bg-bg-surface px-3 py-4',
              // Over the page, from under the bar to the screen's bottom, «خروج» always in view.
              phone && 'fixed start-0 top-(--shifa-size-row) bottom-0 z-10 shadow-overlay',
            )}
          >
            {ITEMS.filter((item) => shown(item.place)).map((item) => (
              <Link
                key={item.place}
                to={item.to}
                className={NAV_ITEM}
                aria-current={item.place === current ? 'page' : undefined}
                onClick={() => {
                  setMenu(false);
                }}
              >
                <Icon name={item.icon} />
                {text(item.key)}
              </Link>
            ))}
            <span className="flex-1" />
            <Button
              variant="ghost"
              startIcon="sign-out"
              className="justify-start"
              onClick={signOut}
            >
              {text('signOutShort')}
            </Button>
          </nav>
        )}
        <main className="flex min-w-0 flex-1 flex-col gap-5 overflow-auto px-4 py-5 md:px-8 md:py-7">
          <div className="flex flex-col gap-1">
            <h1 className="m-0 text-heading-md leading-heading font-semibold">{title}</h1>
            <p className="m-0 text-data leading-body text-text-muted">{description}</p>
          </div>
          <ReadOnlyRefused />
          {ownerEnded && (
            <Callout tone="success" title={text('ownerSupportEndedTitle')}>
              {text('ownerSupportEndedText')}
            </Callout>
          )}
          {children}
        </main>
      </div>
    </div>
  );
}
