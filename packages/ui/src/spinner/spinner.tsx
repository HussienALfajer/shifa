// Spinner (slice 0.4-07), as the owner approved the sheet on 2026-11-22 ("Shifa Components
// (proposals)", page "Data display and table · 0.4-07", OD-64): Shifa's loading indicator, the four
// jasmine petals of the logo on the diagonals lighting in turn. For waits without a known shape (a
// button, a panel, a page); content with a known shape uses Skeleton.
import { useEffect, useRef, useState } from 'react';
import { cn } from '../lib/cn.ts';

const SIZE = {
  sm: 'size-(--shifa-size-icon-sm)',
  md: 'size-(--shifa-size-icon-md)',
  lg: 'size-10',
} as const;

export type SpinnerSize = keyof typeof SIZE;

/** How long a wait must last before the spinner shows, and how long it then stays (OD-64). */
const DELAY_MS = 400;
const MIN_SHOWN_MS = 400;

// Petals from the top-left corner, clockwise; the light moves clockwise, so each petal fades a
// quarter of the cycle after the one before it. The resting opacities are the animation's first
// frame (the lit petal, then its fading trail behind it), so the still mark under reduced motion
// points the same way as the moving one (review: the sheet's still drawing had the trail reversed).
const PETALS = [
  { cx: 12, cy: 12, rotate: -45, className: 'opacity-100 animate-petal-1' },
  { cx: 28, cy: 12, rotate: 45, className: 'opacity-15 animate-petal-2' },
  { cx: 28, cy: 28, rotate: -45, className: 'opacity-30 animate-petal-3' },
  { cx: 12, cy: 28, rotate: 45, className: 'opacity-55 animate-petal-4' },
] as const;

/** The petals alone, hidden from assistive technology: inside a control that says it is busy. */
export function SpinnerMark({
  size = 'sm',
  className,
}: {
  size?: SpinnerSize;
  className?: string | undefined;
}) {
  return (
    <svg
      viewBox="0 0 40 40"
      aria-hidden="true"
      focusable="false"
      className={cn('inline-block shrink-0', SIZE[size], className)}
    >
      {PETALS.map((petal) => (
        <ellipse
          key={`${String(petal.cx)}-${String(petal.cy)}`}
          data-slot="petal"
          cx={petal.cx}
          cy={petal.cy}
          rx="4.5"
          ry="8"
          fill="currentColor"
          transform={`rotate(${String(petal.rotate)} ${String(petal.cx)} ${String(petal.cy)})`}
          className={cn(petal.className, 'motion-reduce:animate-none')}
        />
      ))}
    </svg>
  );
}

export interface SpinnerProps {
  /** sm 20 and md 24 (the icon sizes) for rows and controls; lg 40 for a whole panel or page. */
  size?: SpinnerSize;
  /** What screen readers hear; also shown beside the petals when `showLabel` is set. */
  label?: string;
  /** Shows the label under the petals (a panel wait). */
  showLabel?: boolean;
  /** Milliseconds a wait must last before the spinner shows; 400 by default, so quick loads never flash. */
  delay?: number;
  /** Whether the wait is still running. Keep the spinner mounted and set this to false: once shown it stays at least 400 ms, so it never blinks. */
  active?: boolean;
  className?: string;
}

/** Whether the spinner is on screen: after `delay`, and at least the minimum once shown. */
function useShown(active: boolean, delay: number): boolean {
  const [shown, setShown] = useState(active && delay <= 0);
  const shownAt = useRef<number | null>(shown ? Date.now() : null);
  useEffect(() => {
    if (active) {
      if (shownAt.current !== null) return undefined;
      const timer = setTimeout(
        () => {
          shownAt.current = Date.now();
          setShown(true);
        },
        Math.max(0, delay),
      );
      return () => {
        clearTimeout(timer);
      };
    }
    if (shownAt.current === null) return undefined;
    const left = MIN_SHOWN_MS - (Date.now() - shownAt.current);
    const timer = setTimeout(
      () => {
        shownAt.current = null;
        setShown(false);
      },
      Math.max(0, left),
    );
    return () => {
      clearTimeout(timer);
    };
  }, [active, delay]);
  return shown;
}

/** A wait on its own: a status named «جارٍ التحميل» (or `label`), in the colour of the text around it. */
export function Spinner({
  size = 'sm',
  label = 'جارٍ التحميل',
  showLabel = false,
  delay = DELAY_MS,
  active = true,
  className,
}: SpinnerProps) {
  const shown = useShown(active, delay);
  if (!shown) return null;
  return (
    <span
      role="status"
      aria-label={label}
      className={cn(
        'inline-flex items-center gap-3',
        showLabel && 'flex-col font-ui text-data leading-tight font-medium text-text-muted',
        className,
      )}
    >
      <SpinnerMark size={size} className={showLabel ? 'text-brand-primary' : undefined} />
      {showLabel && <span aria-hidden="true">{label}</span>}
    </span>
  );
}
