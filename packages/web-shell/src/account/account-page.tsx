// My account (slice A-01-10 checkpoint 2), as the owner approved it on 2026-11-24 ("Shifa Screens
// · Clinic web", page "A-01-10 Account batch", prototype `Account10`): «بياناتي» (name, role and
// clinic, the sign-in phone read-only with whom to ask to change it), «كلمة المرور», «التحقق
// بخطوتين» and «أجهزتي» across the page. Three columns on a desktop, one on a phone. What an
// action did is told once in the notice above the cards.
import type { CommonKey } from '@shifa/i18n';
import {
  Avatar,
  Button,
  Callout,
  type CalloutTone,
  Card,
  IconButton,
  Skeleton,
  SkeletonGroup,
  SkeletonText,
} from '@shifa/ui';
import { useState } from 'react';
import { listOf, ROLE_TEXT, type Role } from '../chooser/chooser-text.ts';
import { useText } from '../text.ts';
import { AppFrame } from './app-frame.tsx';
import { isOwner, useActiveClinic, useProfile, useSignedIn } from './data.ts';
import { DevicesCard } from './devices-card.tsx';
import { MfaCard } from './mfa-card.tsx';
import { PasswordDialog } from './password-dialog.tsx';

export interface Note {
  tone: CalloutTone;
  title: string;
  text: string;
}

/** Tells the page what an action did; null clears it. */
export type Tell = (note: Note | null) => void;

const OWNER_ROLE: Record<Role, CommonKey> = { ...ROLE_TEXT, owner: 'setupRoleOwner' };

function MeCard() {
  const text = useText();
  const session = useSignedIn();
  const { data: profile, isPending } = useProfile(session?.userId ?? '');
  const clinic = useActiveClinic(session);
  const roles = listOf(
    [...new Set(session?.roles.map((r) => r.role) ?? [])].map((r) => text(OWNER_ROLE[r])),
  );
  const where = clinic ? `${roles} · ${clinic.name}` : roles;
  return (
    <Card className="gap-4 p-(--shifa-card-padding)">
      <h2 className="m-0 text-heading-sm leading-heading font-semibold">{text('accountMe')}</h2>
      {isPending || !profile ? (
        <SkeletonGroup label={text('accountMeLoading')}>
          <Skeleton shape="circle" className="size-(--shifa-size-avatar-lg)" />
          <SkeletonText lines={2} />
        </SkeletonGroup>
      ) : (
        <>
          <div className="flex items-center gap-4">
            <Avatar name={profile.name} size="lg" />
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <p className="m-0 text-body font-semibold">{profile.name}</p>
              <p className="m-0 text-data leading-body text-text-muted">{where}</p>
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <p className="m-0 text-caption font-medium text-text-muted">
              {text('accountPhoneLabel')}
            </p>
            <bdi data-testid="my-phone" dir="ltr" className="text-body tabular-nums">
              {profile.phoneE164}
            </bdi>
          </div>
          <p className="m-0 text-caption leading-body text-text-muted">
            {text(isOwner(session) ? 'accountChangeHintOwner' : 'accountChangeHintMember')}
          </p>
        </>
      )}
    </Card>
  );
}

function PasswordCard({ tell }: { tell: Tell }) {
  const text = useText();
  const [open, setOpen] = useState(false);
  return (
    <Card className="gap-4 p-(--shifa-card-padding)">
      <h2 className="m-0 text-heading-sm leading-heading font-semibold">{text('pwCardTitle')}</h2>
      <p className="m-0 text-data leading-body text-text-muted">{text('pwCardText')}</p>
      <div>
        <Button
          startIcon="pencil"
          onClick={() => {
            tell(null);
            setOpen(true);
          }}
        >
          {text('pwOpen')}
        </Button>
      </div>
      <PasswordDialog open={open} onOpenChange={setOpen} tell={tell} />
    </Card>
  );
}

export function AccountPage() {
  const text = useText();
  const [note, setNote] = useState<Note | null>(null);
  return (
    <AppFrame current="account" title={text('accountTitle')} description={text('accountText')}>
      {note && (
        <div className="flex items-start gap-2">
          <Callout
            data-testid="account-note"
            tone={note.tone}
            title={note.title}
            className="flex-1"
          >
            {note.text}
          </Callout>
          <IconButton
            icon="x"
            label={text('close')}
            variant="ghost"
            size="sm"
            onClick={() => {
              setNote(null);
            }}
          />
        </div>
      )}
      <div className="grid items-start gap-5 md:grid-cols-3">
        <MeCard />
        <PasswordCard tell={setNote} />
        <MfaCard tell={setNote} />
        <DevicesCard tell={setNote} />
      </div>
    </AppFrame>
  );
}
