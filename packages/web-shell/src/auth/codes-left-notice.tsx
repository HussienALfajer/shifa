// After a recovery-code sign-in (slice A-01-07, prototype `Main`; A-01a criterion 12a): how many
// codes are left, from the challenge's answer. A success notice; a warning at two or fewer, with
// the way to new codes (My account, A-01-10). Shown on the first screen after the challenge.
import { Callout } from '@shifa/ui';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useText } from '../text.ts';
import { codesLeft, forgetCodesLeft } from './setup-view.ts';

const LOW = 2;

export function CodesLeftNotice() {
  const text = useText();
  const queryClient = useQueryClient();
  // Read once, then forgotten: the notice belongs to the first screen after the challenge, not to
  // every later visit in the session (review N6).
  const [left] = useState(() => codesLeft(queryClient));
  useEffect(() => {
    forgetCodesLeft(queryClient);
  }, [queryClient]);
  if (left === undefined) return null;
  const low = left <= LOW;
  return (
    <Callout
      data-testid="codes-left"
      tone={low ? 'warning' : 'success'}
      title={text(low ? 'codesLowTitle' : 'codesLeftTitle', { count: left })}
    >
      {text(low ? 'codesLowText' : 'codesLeftText')}
    </Callout>
  );
}
