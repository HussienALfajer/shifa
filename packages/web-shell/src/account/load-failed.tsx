// A read of My account or the clinic setting that failed (reviewer finding 3, A-01-10 checkpoint
// 2): the card says so and offers «إعادة المحاولة» instead of a skeleton that never ends. Reads
// are not retried by themselves (every request is activity to the server); the person retries.
import { Button, Callout } from '@shifa/ui';
import { useText } from '../text.ts';

export function LoadFailed({ retry }: { retry: () => unknown }) {
  const text = useText();
  return (
    <Callout
      data-testid="load-failed"
      tone="danger"
      icon="wifi-slash"
      title={text('loadFailedTitle')}
      action={
        <Button size="sm" variant="secondary" onClick={() => void retry()}>
          {text('retry')}
        </Button>
      }
    >
      {text('loadFailedText')}
    </Callout>
  );
}
