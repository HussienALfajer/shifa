// A new TOTP key on My account (slice A-01-10): the QR code and the manual key in groups of four
// with copy, for a staff enrolment (checkpoint 2) and for moving TOTP to a new phone (checkpoint
// 3). The key and its URI live in the caller's state only.
import type { Schemas } from '@shifa/api-client-ts';
import { Button, QrCode } from '@shifa/ui';
import { useState } from 'react';
import { useText } from '../text.ts';

const grouped = (key: string) => key.replace(/(.{4})(?=.)/g, '$1 ');

export function TotpKey({ value }: { value: Schemas['TotpEnrolStart'] }) {
  const text = useText();
  const [copied, setCopied] = useState(false);
  return (
    <>
      <QrCode value={value.otpauthUri} label={text('enrolQrLabel')} className="self-center" />
      <div className="flex flex-col gap-2">
        <p className="m-0 text-caption font-medium text-text-muted">{text('codesEnrolKey')}</p>
        <div className="flex items-center gap-2">
          <bdi
            dir="ltr"
            translate="no"
            className="flex-1 rounded-input border border-border-default bg-bg-surface-raised px-3 py-2 font-mono text-data break-all"
          >
            {grouped(value.manualKey)}
          </bdi>
          <Button
            size="sm"
            startIcon={copied ? 'check' : 'copy'}
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(value.manualKey);
                setCopied(true);
              } catch {
                // Refused: the key stays on screen to type.
              }
            }}
          >
            {text(copied ? 'enrolKeyCopied' : 'enrolCopyKey')}
          </Button>
        </div>
      </div>
    </>
  );
}
