// The recovery codes after enrolment (slice A-01-07 checkpoint 3), as the owner approved them on
// 2026-11-24 (prototype `Main`, `CodeListSheet`; improvement c): the ten codes once, copy all,
// the print sheet with the person, the clinic and today's date, and «حفظتُ الرموز» required
// before going on. The codes live in this screen's memory only: never stored, never sent; they go
// when the person goes on. The confirmed session is already in the cache; going on lets the guard
// route it (the clinic, the chooser, admin web).
import { Badge, Button, Checkbox, CodeList } from '@shifa/ui';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import logoColour from '../../../../docs/brand/logo/shifa-logo-horizontal-color.svg';
import type { SessionView } from '../session.ts';
import { useText } from '../text.ts';
import { AuthLayout } from './auth-layout.tsx';
import { dayDate } from './dates.ts';
import { useMyName } from './me.ts';
import { setupPerson } from './setup-view.ts';

export function RecoveryCodes({ codes, session }: { codes: string[]; session: SessionView }) {
  const text = useText();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [saved, setSaved] = useState(false);
  const fromLink = setupPerson(queryClient);
  const name = useMyName(session.userId) ?? fromLink?.personName ?? '';
  const place = session.platformAdmin ? text('brandAdminTitle') : (fromLink?.clinicName ?? null);
  const who = place === null ? name : `${name} · ${place}`;

  return (
    <AuthLayout brand={false}>
      <div className="flex flex-col items-start gap-2">
        <Badge tone="success" size="md">
          {text('codesBadge')}
        </Badge>
        <h1 className="m-0 text-heading-md leading-heading font-semibold">{text('codesTitle')}</h1>
        <p className="m-0 text-body leading-body text-text-muted">{text('codesText')}</p>
      </div>
      <CodeList
        codes={codes}
        label={text('codesListLabel')}
        copyLabel={text('codesCopy')}
        copiedLabel={text('codesCopied')}
        printLabel={text('codesPrint')}
        print={{
          title: text('codesPrintTitle'),
          who,
          date: text('codesPrintDate', { date: dayDate(Date.now()) }),
          note: text('codesPrintNote'),
          logoSrc: logoColour,
          logoAlt: text('appName'),
        }}
      />
      <Checkbox checked={saved} onCheckedChange={setSaved} description={text('codesSavedNote')}>
        {text('codesSaved')}
      </Checkbox>
      <Button
        variant="primary"
        size="lg"
        endIcon="arrow-forward"
        disabled={!saved}
        onClick={() => navigate({ to: '/' })}
      >
        {text(session.platformAdmin ? 'codesToAdmin' : 'codesToClinic')}
      </Button>
    </AuthLayout>
  );
}
