// QrCode (slice A-01-07), as the owner approved the sheet on 2026-11-24 ("Shifa Screens · Clinic
// web", page "A-01-07 Sign-in batch", `QrCodeSheet`, ADR-0046): the TOTP enrolment's otpauth URI
// drawn as a code a camera reads. Encoded here, in the page (uqr, error correction M, a quiet zone
// of four modules), never by a service: the URI carries the secret key. The plate stays light and
// the modules dark in both themes (`color.scan.*`), and the code is never mirrored in RTL. Without
// a value it is the loading state (a spinner in the code's place, the same size); an error is the
// page's Callout, never an empty code.
import { useMemo } from 'react';
import { encode } from 'uqr';
import { cn } from '../lib/cn.ts';
import { Spinner } from '../spinner/spinner.tsx';

/** Modules of light space around the code, as the QR standard asks. */
const QUIET_ZONE = 4;

export interface QrCodeProps {
  /** The text to encode (an `otpauth://totp/…` URI). Never logged or shown as text here. Absent: loading. */
  value?: string | undefined;
  /** What screen readers hear, e.g. «رمز QR لإضافة حساب شفاء إلى تطبيق المصادقة». */
  label: string;
  className?: string;
}

/** One SVG path of every dark module, one unit per module, the quiet zone included. */
function modulesPath(value: string): { size: number; d: string } {
  const { data, size } = encode(value, { ecc: 'M', border: QUIET_ZONE });
  const parts: string[] = [];
  data.forEach((row, y) => {
    row.forEach((dark, x) => {
      if (dark) parts.push(`M${String(x)} ${String(y)}h1v1h-1z`);
    });
  });
  return { size, d: parts.join('') };
}

const PLATE =
  'flex size-(--shifa-width-37-5) shrink-0 items-center justify-center overflow-hidden rounded-input border border-border-default';

export function QrCode({ value, label, className }: QrCodeProps) {
  const drawn = useMemo(() => (value ? modulesPath(value) : null), [value]);
  if (drawn === null) {
    return (
      <span
        data-slot="qr-code"
        data-state="loading"
        className={cn(PLATE, 'bg-bg-surface-raised', className)}
      >
        <Spinner size="lg" delay={0} label={label} />
      </span>
    );
  }
  return (
    <span
      data-slot="qr-code"
      data-state="ready"
      role="img"
      aria-label={label}
      // The code reads the same in both directions: never mirrored.
      dir="ltr"
      className={cn(PLATE, 'bg-scan-bg', className)}
    >
      <svg
        viewBox={`0 0 ${String(drawn.size)} ${String(drawn.size)}`}
        aria-hidden="true"
        focusable="false"
        shapeRendering="crispEdges"
        className="block size-full"
      >
        <rect width={drawn.size} height={drawn.size} className="fill-scan-bg" />
        <path d={drawn.d} className="fill-scan-fg" />
      </svg>
    </span>
  );
}
