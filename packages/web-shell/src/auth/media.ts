// Phone sizes (slice A-01-07): below Tailwind's `md` (768 px), as the drawings' phone artboard.
// Where a screen changes what it offers, not only its layout (the enrolment's QR folds on a phone),
// CSS is not enough.
import { useEffect, useState } from 'react';

const PHONE = '(max-width: 47.99rem)';
/** Below Tailwind's `lg` (1024 px): a tablet or a phone, where a drawer is a bottom sheet. */
const BELOW_DESKTOP = '(max-width: 63.99rem)';

function matches(media: string): boolean {
  return typeof globalThis.matchMedia === 'function' && globalThis.matchMedia(media).matches;
}

function useMedia(media: string): boolean {
  const [on, setOn] = useState(() => matches(media));
  useEffect(() => {
    if (typeof globalThis.matchMedia !== 'function') return undefined;
    const query = globalThis.matchMedia(media);
    const change = () => {
      setOn(query.matches);
    };
    query.addEventListener('change', change);
    return () => {
      query.removeEventListener('change', change);
    };
  }, [media]);
  return on;
}

export function useIsPhone(): boolean {
  return useMedia(PHONE);
}

export function useBelowDesktop(): boolean {
  return useMedia(BELOW_DESKTOP);
}
