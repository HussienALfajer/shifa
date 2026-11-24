// CopyField (slice A-01-10), as the owner approved the sheet on 2026-11-24 ("Shifa Screens · Clinic
// web", page "A-01-10 Account batch", `CopyFieldSheet`, ADR-0046): a value shown once to copy or
// send (a setup link, a member's link). Read-only, left to right in the mono font in both
// directions, the copy button inside the box at the logical end; an optional WhatsApp share and an
// expiry line under it. Focus selects the whole value. Copied: the button reads «نُسخ» with a tick
// for three seconds, announced once. A refused clipboard selects the value and asks to copy it by
// hand. Multiline wraps a long value; `iconOnly` keeps a phone's copy to its icon. Disabled (a
// replaced link): muted, nothing to copy or share. Without a value: loading. The value is never
// stored or sent anywhere by this component.
import { type FocusEvent, useEffect, useId, useRef, useState } from 'react';
import { Button, buttonClasses, buttonIconSize } from '../button/button.tsx';
import { FIELD_BOX } from '../field/field-shell.tsx';
import { Icon } from '../icons/icon.tsx';
import { cn } from '../lib/cn.ts';
import { Skeleton } from '../skeleton/skeleton.tsx';

const COPIED_FOR_MS = 3000;

export interface CopyFieldShare {
  /** The address to open (`https://wa.me/?text=…`), from the server. */
  href: string;
  /** «إرسال عبر واتساب». */
  label: string;
}

export interface CopyFieldProps {
  /** The value to copy. Absent: loading. */
  value?: string | undefined;
  /** The field's name, shown above it and read by screen readers («رابط الإعداد»). */
  label: string;
  copyLabel?: string;
  copiedLabel?: string;
  /** Shown when the clipboard refused: the value is selected to copy by hand. */
  refusedText?: string;
  /** A share link beside the expiry line (WhatsApp); hidden when disabled. */
  share?: CopyFieldShare | undefined;
  /** The line under the box: «ينتهي بعد 72 ساعة», or why it is disabled. */
  expiry?: string | undefined;
  /** Wraps a long value over several lines (a phone). */
  multiline?: boolean;
  /** The copy button shows its icon only (still named). */
  iconOnly?: boolean;
  /** A value that no longer works (a replaced link): muted, no copy, no share. */
  disabled?: boolean;
  /** After the value reached the clipboard. */
  onCopied?: () => void;
  /** After the share link was pressed. */
  onShared?: () => void;
  className?: string;
}

const VALUE = cn(
  'min-w-0 flex-1 self-stretch border-0 bg-transparent p-0 font-mono text-data leading-body text-text-default outline-none',
  'py-2 in-data-[density=compact]:py-1',
);

export function CopyField({
  value,
  label,
  copyLabel = 'نسخ',
  copiedLabel = 'نُسخ',
  refusedText = 'لم يُنسخ. الرابط محدّد: انسخه بنفسك.',
  share,
  expiry,
  multiline = false,
  iconOnly = false,
  disabled = false,
  onCopied,
  onShared,
  className,
}: CopyFieldProps) {
  const id = useId();
  const valueId = `${id}-value`;
  const expiryId = `${id}-expiry`;
  const [copied, setCopied] = useState(false);
  const [refused, setRefused] = useState(false);
  // A new value was never copied: forget the last one's copied or refused state.
  const [shownValue, setShownValue] = useState(value);
  if (shownValue !== value) {
    setShownValue(value);
    setCopied(false);
    setRefused(false);
  }
  const input = useRef<HTMLInputElement & HTMLTextAreaElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(
    () => () => {
      clearTimeout(timer.current);
    },
    [],
  );

  function selectAll() {
    const el = input.current;
    if (!el) return;
    el.focus();
    el.setSelectionRange(0, el.value.length);
  }

  async function copy() {
    if (disabled || value === undefined) return;
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      setRefused(true);
      selectAll();
      return;
    }
    setRefused(false);
    setCopied(true);
    onCopied?.();
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setCopied(false);
    }, COPIED_FOR_MS);
  }

  const onFocus = (event: FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const el = event.currentTarget;
    el.setSelectionRange(0, el.value.length);
  };

  const shared = {
    id: valueId,
    ref: input,
    'data-slot': 'copy-field-value',
    value: value ?? '',
    readOnly: true,
    dir: 'ltr',
    translate: 'no',
    spellCheck: false,
    'aria-disabled': disabled || undefined,
    'aria-describedby': expiry === undefined ? undefined : expiryId,
    onFocus,
    // A selection on mouse up would undo the one made on focus.
    onMouseUp: (event: { preventDefault: () => void }) => {
      event.preventDefault();
    },
  } as const;

  const loading = value === undefined;
  const name = copied ? copiedLabel : copyLabel;
  return (
    <div data-slot="copy-field-root" className={cn('flex flex-col gap-2 font-ui', className)}>
      <label htmlFor={valueId} className="text-200 leading-body font-medium text-text-default">
        {label}
      </label>
      <div
        data-slot="copy-field"
        aria-busy={loading || undefined}
        className={cn(
          FIELD_BOX,
          'bg-bg-surface-raised ps-3 pe-1',
          multiline && 'items-start py-1',
          disabled && 'border-border-default hover:border-border-default',
        )}
      >
        {loading ? (
          <Skeleton shape="line" className="my-3 flex-1" />
        ) : multiline ? (
          <textarea
            {...shared}
            rows={2}
            className={cn(
              VALUE,
              'resize-none break-all field-sizing-content',
              disabled && 'text-text-muted',
            )}
          />
        ) : (
          <input {...shared} type="text" className={cn(VALUE, disabled && 'text-text-muted')} />
        )}
        {!loading &&
          (iconOnly ? (
            <Button
              size="sm"
              variant="ghost"
              startIcon={copied ? 'check' : 'copy'}
              disabled={disabled}
              aria-label={name}
              className={cn('shrink-0', multiline && 'mt-0.5')}
              onClick={copy}
            />
          ) : (
            <Button
              size="sm"
              variant="ghost"
              startIcon={copied ? 'check' : 'copy'}
              disabled={disabled}
              className={cn('shrink-0', multiline && 'mt-0.5')}
              onClick={copy}
            >
              {name}
            </Button>
          ))}
      </div>
      {(expiry !== undefined || (share !== undefined && !disabled)) && (
        <div className="flex flex-wrap items-center gap-3">
          {share !== undefined && !disabled && !loading && (
            <a
              href={share.href}
              target="_blank"
              rel="noreferrer noopener"
              className={cn(buttonClasses({ size: 'sm' }), 'no-underline')}
              onClick={() => onShared?.()}
            >
              <Icon name="share" size={buttonIconSize('sm')} />
              {share.label}
            </a>
          )}
          {expiry !== undefined && (
            <span id={expiryId} className="text-200 leading-body text-text-muted">
              {expiry}
            </span>
          )}
        </div>
      )}
      {refused && (
        <p className="m-0 flex items-center gap-1 text-200 leading-body text-status-warning-fg">
          <Icon name="warning" size="sm" />
          {refusedText}
        </p>
      )}
      {/* Always mounted: screen readers announce a change inside a live region that exists. */}
      <span role="status" className="sr-only">
        {copied ? copiedLabel : ''}
      </span>
    </div>
  );
}
