// CodeList (slice A-01-07), as the owner approved the sheet on 2026-11-24 ("Shifa Screens · Clinic
// web", page "A-01-07 Sign-in batch", `CodeListSheet`, ADR-0046): the ten recovery codes shown
// once, numbered, monospaced, in two columns laid out left to right in both directions, with
// «نسخ الكل» (one line per code, no numbers; «نُسخت الرموز العشرة» with a tick for three seconds)
// and «طباعة» (only the print sheet prints: light in both themes, the person, the clinic and the
// date above the codes, a box to cross out each). The codes are never stored or sent anywhere:
// they live in the caller's memory and go with the screen.
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '../button/button.tsx';
import { cn } from '../lib/cn.ts';

const COPIED_FOR_MS = 3000;

export interface CodeListPrint {
  /** «رموز الاسترداد لحساب شفاء». */
  title: string;
  /** The person and the clinic: «رنا العلي · مجمع العلي الطبي». */
  who: string;
  /** «طُبعت 24/11/2026». */
  date: string;
  /** The advice under the codes. */
  note: string;
  /** A logo above the title (the colour lockup: the sheet is always light). */
  logoSrc?: string;
  logoAlt?: string;
}

export interface CodeListProps {
  /** The codes as the server sent them (`recoveryCodes`). */
  codes: readonly string[];
  /** The list's name for screen readers. */
  label?: string;
  copyLabel?: string;
  copiedLabel?: string;
  printLabel?: string;
  /** What the print sheet says; without it there is no «طباعة». */
  print?: CodeListPrint;
  /** After the codes reached the clipboard. */
  onCopied?: () => void;
  className?: string;
}

const CODES = 'm-0 grid list-none grid-cols-2 gap-2 p-0 in-data-[density=compact]:gap-1';

export function CodeList({
  codes,
  label = 'رموز الاسترداد العشرة',
  copyLabel = 'نسخ الكل',
  copiedLabel = 'نُسخت الرموز العشرة',
  printLabel = 'طباعة',
  print,
  onCopied,
  className,
}: CodeListProps) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(
    () => () => {
      clearTimeout(timer.current);
    },
    [],
  );

  async function copy() {
    try {
      await navigator.clipboard.writeText(codes.join('\n'));
    } catch {
      return; // Clipboard refused: the codes stay on screen to write down or print.
    }
    setCopied(true);
    onCopied?.();
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setCopied(false);
    }, COPIED_FOR_MS);
  }

  return (
    <div data-slot="code-list" className={cn('flex flex-col gap-4 font-ui', className)}>
      {/* Codes read left to right in Arabic too; the list is isolated from the page's direction. */}
      <ol aria-label={label} dir="ltr" className={CODES}>
        {codes.map((code, i) => (
          <li
            key={code}
            className={cn(
              'flex items-baseline justify-center gap-2 rounded-input border border-border-default bg-bg-surface-raised px-3 py-2 text-text-default',
              'in-data-[density=compact]:px-2 in-data-[density=compact]:py-1',
            )}
          >
            <span
              aria-hidden="true"
              className="text-caption leading-body font-medium text-text-muted tabular-nums"
            >
              {i + 1}.
            </span>
            <span
              data-slot="code"
              className="font-mono text-data leading-body font-medium tabular-nums"
            >
              {code}
            </span>
          </li>
        ))}
      </ol>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" startIcon={copied ? 'check' : 'file-text'} onClick={copy}>
          {copied ? copiedLabel : copyLabel}
        </Button>
        {print !== undefined && (
          <Button
            size="sm"
            startIcon="printer"
            onClick={() => {
              globalThis.print();
            }}
          >
            {printLabel}
          </Button>
        )}
      </div>
      {copied && (
        <span role="status" className="sr-only">
          {copiedLabel}
        </span>
      )}
      {print !== undefined &&
        createPortal(<PrintSheet codes={codes} print={print} />, document.body)}
    </div>
  );
}

/**
 * The paper: hidden on screen; when printing, the page shows it alone (`tailwind.css`, print).
 * Light paper and dark ink in both themes (`color.scan.*`, the same fixed pair as a QR code).
 */
function PrintSheet({ codes, print }: { codes: readonly string[]; print: CodeListPrint }) {
  return (
    <div
      data-slot="code-list-print"
      aria-hidden="true"
      className="hidden flex-col gap-4 bg-scan-bg p-8 font-ui text-scan-fg print:flex"
    >
      <div className="flex items-center justify-between gap-4">
        {print.logoSrc !== undefined && (
          <img
            src={print.logoSrc}
            alt={print.logoAlt ?? ''}
            className="h-auto w-(--shifa-width-24)"
          />
        )}
        <span className="text-data leading-body tabular-nums">{print.date}</span>
      </div>
      <div className="flex flex-col gap-1">
        <p className="m-0 text-heading-sm leading-heading font-semibold">{print.title}</p>
        <p className="m-0 text-data leading-body">{print.who}</p>
      </div>
      <ol dir="ltr" className={CODES}>
        {codes.map((code, i) => (
          <li key={code} className="flex items-center gap-2">
            <span className="size-4 shrink-0 rounded-mark border border-scan-fg" />
            <span className="text-caption leading-body font-medium tabular-nums">{i + 1}.</span>
            <span className="font-mono text-data leading-body font-medium">{code}</span>
          </li>
        ))}
      </ol>
      <p className="m-0 text-data leading-body">{print.note}</p>
    </div>
  );
}
