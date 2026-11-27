// What admin web's flags, announcements, cities and areas share (slice A-02-09): the page's
// message after an action or a refusal a dialog could not fix, a field named by a 400, when
// something happened («اليوم 14:05», «24/11/2026»), and the clinic picker of a flag or an
// announcement (MultiCombobox over GET /platform/clinics, matched on the client with the shared
// Arabic fold, as Combobox; contract row "Flags · clinic picker").
import { Callout, MultiCombobox } from '@shifa/ui';
import { dayDate } from '../auth/dates.ts';
import { clockTime } from '../auth/lock.ts';
import { useText } from '../text.ts';
import { useClinics } from './data.ts';

export interface AdminNote {
  tone: 'success' | 'warning' | 'danger';
  title: string;
  text?: string;
}

export function NoteCallout({ note }: { note: AdminNote | null }) {
  if (!note) return null;
  return (
    <Callout data-testid="admin-note" tone={note.tone} title={note.title}>
      {note.text}
    </Callout>
  );
}

/** A 400 `validation_failed` that names this field (`body.clinicIds`). */
export function fieldRefused(error: unknown, path: string): boolean {
  const body = error as { error?: { code?: unknown; details?: unknown } } | null | undefined;
  if (body?.error?.code !== 'validation_failed') return false;
  const details = body.error.details;
  return (
    Array.isArray(details) && details.some((d) => (d as { path?: unknown } | null)?.path === path)
  );
}

const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

/** `14:05` today on this device, otherwise `24/11/2026`. */
export function useWhen(): (iso: string) => string {
  const text = useText();
  return (iso) => {
    const at = Date.parse(iso);
    return sameDay(new Date(at), new Date())
      ? text('annToday', { time: clockTime(at) })
      : dayDate(at);
  };
}

/** `24/11 08:00`, or `اليوم 08:00`: a moment of an announcement's period. */
export function useMoment(): (iso: string) => string {
  const text = useText();
  return (iso) => {
    const at = Date.parse(iso);
    const d = new Date(at);
    if (sameDay(d, new Date())) return text('annToday', { time: clockTime(at) });
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)} ${clockTime(at)}`;
  };
}

export interface PickedClinic {
  id: string;
  name: string;
}

/**
 * The clinics of a flag or an announcement. `known` are the chosen ones as the answer named
 * them, so a chip has its name before the clinics are read.
 */
export function ClinicPicker({
  value,
  onValueChange,
  known,
  hint,
  error,
}: {
  value: readonly string[];
  onValueChange: (ids: string[]) => void;
  known: readonly PickedClinic[];
  hint: string;
  error: boolean;
}) {
  const text = useText();
  const { data } = useClinics('');
  const items = new Map<string, string>();
  for (const c of known) items.set(c.id, c.name);
  for (const c of data ?? []) items.set(c.id, c.name);
  return (
    <MultiCombobox
      label={text('pickerLabel')}
      placeholder={text('pickerPlaceholder')}
      emptyMessage={text('pickerEmpty')}
      items={[...items].map(([id, name]) => ({ value: id, label: name }))}
      value={value}
      onValueChange={onValueChange}
      hint={hint}
      error={error ? text('pickerError') : undefined}
    />
  );
}
