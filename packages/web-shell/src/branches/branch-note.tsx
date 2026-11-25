// The branches page's message (slice A-01-08 checkpoint 4): what was just done, or a refusal a
// dialog could not fix, as the approved Callout above the cards.
import { Callout } from '@shifa/ui';

export interface PageNote {
  tone: 'success' | 'warning' | 'danger';
  title: string;
  text?: string;
}

export function BranchNote({ note }: { note: PageNote | null }) {
  if (!note) return null;
  return (
    <Callout data-testid="branches-note" tone={note.tone} title={note.title}>
      {note.text}
    </Callout>
  );
}
