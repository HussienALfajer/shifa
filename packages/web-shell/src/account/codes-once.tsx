// The ten recovery codes shown once inside a dialog of My account (slice A-01-10): after new codes,
// a staff enrolment (checkpoint 2) or moving TOTP to a new phone (checkpoint 3). Copy and print,
// then «حفظتُ الرموز» before «تم». The codes live in the caller's state only.
import { Button, Callout, Checkbox, CodeList, DialogActions } from '@shifa/ui';
import { useState } from 'react';
import logoColour from '../../../../docs/brand/logo/shifa-logo-horizontal-color.svg';
import { dayDate } from '../auth/dates.ts';
import { useText } from '../text.ts';
import { useActiveClinic, useProfile, useSignedIn } from './data.ts';

export function CodesOnce({
  codes,
  note,
  onDone,
}: {
  codes: string[];
  /** Why they matter now: the old set is gone, or they are the only way back in. */
  note: string;
  onDone: () => void;
}) {
  const text = useText();
  const session = useSignedIn();
  const { data: profile } = useProfile(session?.userId ?? '');
  const clinic = useActiveClinic(session);
  const [saved, setSaved] = useState(false);
  const who = [profile?.name, clinic?.name].filter(Boolean).join(' · ');
  return (
    <>
      <Callout tone="info" title={text('codesOnceTitle')}>
        {note}
      </Callout>
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
      <DialogActions>
        <Button variant="primary" disabled={!saved} onClick={onDone}>
          {text('codesDone')}
        </Button>
      </DialogActions>
    </>
  );
}
