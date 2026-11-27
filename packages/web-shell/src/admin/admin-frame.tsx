// The frame of admin web's signed-in pages (slice A-01-10 checkpoint 3; prototype `Main` on
// "Shifa Screens · Admin web", approved 2026-11-24): the top bar (the logo, «إدارة شفاء», the
// person's avatar) and the navigation at the start of the line («العيادات», «خروج»). Admin web is
// drawn for the desktop only.
import { Avatar, Button, cn, Icon } from '@shifa/ui';
import { Link } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import logoColour from '../../../../docs/brand/logo/shifa-logo-horizontal-color.svg';
import logoReverse from '../../../../docs/brand/logo/shifa-logo-horizontal-reverse.svg';
import { useProfile, useSignedIn } from '../account/data.ts';
import { useText } from '../text.ts';
import { useSignOut } from '../use-sign-out.ts';

const NAV_ITEM = cn(
  'flex h-(--shifa-size-control-md) items-center gap-3 rounded-control px-3 font-medium text-text-default no-underline',
  'hover:bg-selection-subtle focus-visible:shadow-focus focus-visible:outline-2 focus-visible:outline-border-focus',
  'aria-[current=page]:bg-selection-default aria-[current=page]:font-semibold',
);

const ADMIN_NAV = [
  { to: '/flags', icon: 'list', label: 'navFlags' },
  { to: '/announcements', icon: 'bell', label: 'navAnnouncements' },
  { to: '/places', icon: 'buildings', label: 'navPlaces' },
] as const;

export function AdminFrame({
  title,
  description,
  actions,
  children,
}: {
  title: ReactNode;
  description?: ReactNode;
  /** Buttons at the end of the title's line. */
  actions?: ReactNode;
  children: ReactNode;
}) {
  const text = useText();
  const session = useSignedIn();
  const { data: profile } = useProfile(session?.userId ?? '');
  const signOut = useSignOut();
  return (
    <div className="flex min-h-dvh flex-col bg-bg-app font-ui text-text-default">
      <header className="flex h-(--shifa-size-row) shrink-0 items-center gap-3 border-b border-border-default bg-bg-surface px-4">
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
        <span className="text-data font-medium">{text('adminAppName')}</span>
        <span className="flex-1" />
        <Avatar name={profile?.name ?? ''} size="sm" />
      </header>
      <div className="flex min-h-0 flex-1">
        <nav
          aria-label={text('navLabel')}
          className="flex w-(--shifa-width-60) shrink-0 flex-col gap-1 border-e border-border-default bg-bg-surface px-3 py-4"
        >
          <Link
            to="/"
            className={NAV_ITEM}
            activeOptions={{ includeSearch: false }}
            activeProps={{ 'aria-current': 'page' }}
          >
            <Icon name="house" />
            {text('navClinics')}
          </Link>
          {/* A-02-09: the drawn navigation of `A02Flags`, `A02Announcements`, `A02Cities`. */}
          {ADMIN_NAV.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={NAV_ITEM}
              activeProps={{ 'aria-current': 'page' }}
            >
              <Icon name={item.icon} />
              {text(item.label)}
            </Link>
          ))}
          <span className="flex-1" />
          <Button variant="ghost" startIcon="sign-out" className="justify-start" onClick={signOut}>
            {text('signOutShort')}
          </Button>
        </nav>
        <main className="flex min-w-0 flex-1 flex-col gap-5 overflow-auto px-8 py-7">
          <div className="flex flex-wrap items-start gap-3">
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <h1 className="m-0 text-heading-md leading-heading font-semibold">{title}</h1>
              {description !== undefined && (
                <p className="m-0 text-data leading-body text-text-muted">{description}</p>
              )}
            </div>
            {actions}
          </div>
          {children}
        </main>
      </div>
    </div>
  );
}
