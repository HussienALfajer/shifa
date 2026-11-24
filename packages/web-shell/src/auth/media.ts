// Phone sizes (slice A-01-07): below Tailwind's `md` (768 px), as the drawings' phone artboard.
// Where a screen changes what it offers, not only its layout (the enrolment's QR folds on a phone),
// CSS is not enough.
import { useEffect, useState } from 'react';

const PHONE = '(max-width: 47.99rem)';

function matches(): boolean {
  return typeof globalThis.matchMedia === 'function' && globalThis.matchMedia(PHONE).matches;
}

export function useIsPhone(): boolean {
  const [phone, setPhone] = useState(matches);
  useEffect(() => {
    if (typeof globalThis.matchMedia !== 'function') return undefined;
    const query = globalThis.matchMedia(PHONE);
    const change = () => {
      setPhone(query.matches);
    };
    query.addEventListener('change', change);
    return () => {
      query.removeEventListener('change', change);
    };
  }, []);
  return phone;
}
