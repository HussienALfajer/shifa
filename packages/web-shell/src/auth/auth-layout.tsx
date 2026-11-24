// The frame of the signed-out pages (slice A-01-07; prototype `Main`, approved 2026-11-24): on a
// desktop the night-green brand panel at the start of the line (the logo, what the app is, the
// safety line) and the form beside it; on tablets and phones the logo above the form. Sign-in,
// the setup link and the MFA steps share it, in both apps.
import { cn } from '@shifa/ui';
import type { ReactNode } from 'react';
import logoColour from '../../../../docs/brand/logo/shifa-logo-horizontal-color.svg';
import logoReverse from '../../../../docs/brand/logo/shifa-logo-horizontal-reverse.svg';
import { useText } from '../pages.tsx';
import { useShell } from '../providers.tsx';

/**
 * `brand` (default) shows the brand panel on desktops: sign-in and the setup link. The MFA steps
 * pass false and keep the logo above the form at every size, as drawn.
 */
export function AuthLayout({ children, brand = true }: { children: ReactNode; brand?: boolean }) {
  const text = useText();
  const { app } = useShell();
  const appName = text('appName');
  return (
    <main className="flex min-h-dvh bg-bg-app font-ui text-text-default">
      <aside
        className={cn(
          'hidden w-(--shifa-width-120) shrink-0 flex-col justify-between bg-nav-bg p-13 text-nav-text',
          brand && 'lg:flex',
        )}
      >
        <img src={logoReverse} alt={appName} className="h-auto w-(--shifa-width-37-5) self-start" />
        <div className="flex flex-col gap-2">
          <p className="m-0 text-heading-md leading-heading font-semibold">
            {text(app === 'admin' ? 'brandAdminTitle' : 'brandClinicTitle')}
          </p>
          <p className="m-0 text-body-lg leading-body">
            {text(app === 'admin' ? 'brandAdminText' : 'brandClinicText')}
          </p>
        </div>
        <p className="m-0 text-caption leading-body">{text('brandSafety')}</p>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col items-center overflow-auto px-6 pt-10 pb-8 md:justify-center md:px-8 md:py-12">
        <div className="flex w-full flex-col gap-5 md:w-(--shifa-width-120) lg:w-(--shifa-width-100)">
          <img
            src={logoColour}
            alt={appName}
            className={cn(
              'h-auto w-(--shifa-width-37-5) self-center dark:hidden',
              brand && 'lg:hidden',
            )}
          />
          <img
            src={logoReverse}
            alt={appName}
            className={cn(
              'hidden h-auto w-(--shifa-width-37-5) self-center dark:block',
              brand && 'lg:dark:hidden',
            )}
          />
          {children}
        </div>
      </div>
    </main>
  );
}
