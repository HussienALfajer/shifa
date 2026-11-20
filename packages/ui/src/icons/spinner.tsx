// The busy indicator of the approved Button sheet: a faint track and a quarter arc in the text
// colour, turning once every 800 ms; still under reduced motion (the label says it is busy).
import { cn } from '../lib/cn.ts';

const SIZE = { sm: 'size-(--shifa-size-icon-sm)', md: 'size-(--shifa-size-icon-md)' } as const;

export function Spinner({
  size = 'sm',
  className,
}: {
  size?: keyof typeof SIZE;
  className?: string | undefined;
}) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
      focusable="false"
      className={cn(
        'inline-block shrink-0 animate-spin motion-reduce:animate-none',
        SIZE[size],
        className,
      )}
    >
      <circle cx="10" cy="10" r="7.5" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2" />
      <path
        d="M10 2.5a7.5 7.5 0 0 1 7.5 7.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}
