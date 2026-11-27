// The record components of A-03 (sheets approved by the owner 2026-11-27, A-03-01), as
// documentation; bundle.ts appends this file to index.d.ts. The source of truth is packages/ui/src.
import type { IconName } from './index.d.ts';

type Tone = 'neutral' | 'brand' | 'outline' | 'success' | 'warning' | 'danger' | 'info';
// Joined into one file with index.d.ts (bundle.ts), so this name must not repeat one there.
type A03Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

export interface RecordListItem {
  id: string;
  title: string;
  /** Indexes of the title's words that matched the search, shown heavier (never coloured). */
  matches?: number[];
  avatarName?: string;
  /** A type icon in place of the avatar. */
  icon?: IconName;
  /** The second line: short texts (`kind: 'latin'` isolated LTR) and badges. */
  details?: (
    | { text: string; kind?: 'text' | 'latin' }
    | { badge: string; tone?: Tone; icon?: IconName }
  )[];
  /** One per column in the table layout; in two lines and tiles they join the second line. */
  cells?: { text: string; kind?: 'text' | 'number' | 'latin' | 'muted'; icon?: IconName }[];
  /** The whole row is this link (when there is no action or tools). */
  href?: string;
  action?: { label: string; variant?: A03Variant };
  tools?: { icon: IconName; label: string; disabled?: boolean }[];
  badge?: { label: string; tone?: Tone; icon?: IconName };
  /** A record hidden from the viewer: no avatar, no name, no link. */
  locked?: boolean;
  lockedLabel?: string;
  dim?: boolean;
  current?: boolean;
}

/** Rows of people or records (A-03): search results, a family, candidates, doctors, fields. */
export interface RecordListProps {
  'aria-label': string;
  items: RecordListItem[];
  /** table (default; two lines under 640 px), stack (two lines), tiles. */
  layout?: 'table' | 'stack' | 'tiles';
  size?: 'md' | 'sm';
  columns?: { header: string; weight?: number }[];
  titleHeader?: string;
  framed?: boolean;
  chevron?: boolean;
  loading?: boolean;
  loadingRows?: number;
  loadingLabel?: string;
  empty?: { title: string; description?: string; icon?: IconName };
  footer?: string;
}

export declare const RecordList: (props: RecordListProps) => unknown;

/** A record's identity at the top of its page (A-03). */
export interface RecordHeaderProps {
  'aria-label'?: string;
  title: string;
  avatarName?: string;
  idLabel?: string;
  /** The number in the gold tag («ملف 1043»). */
  idValue?: string;
  /** `tip`: a Tooltip explains the badge (an estimated age); the badge then takes focus. */
  badges?: { label: string; tone?: Tone; icon?: IconName; tip?: string }[];
  facts?: { label: string; value: string; kind?: 'text' | 'number' | 'latin' }[];
  meta?: string;
  /** Buttons by label, and at most one menu (Menu's props with `menu: true`). */
  actions?: (
    | { label: string; icon?: IconName; variant?: A03Variant }
    | ({ menu: true } & Record<string, unknown>)
  )[];
  readOnlyNote?: string;
  /** Archived or merged: raised surface, no actions. */
  muted?: boolean;
  /** Inside a panel: h2, no facts, a larger number. */
  compact?: boolean;
  loading?: boolean;
  loadingLabel?: string;
}

export declare const RecordHeader: (props: RecordHeaderProps) => unknown;

/** Labels and values by section (A-03): a dl per section, «—» for empty, one badge per value. */
export interface DescriptionListProps {
  'aria-label': string;
  sections: {
    id: string;
    title?: string;
    rows: {
      id: string;
      label: string;
      value?: string;
      kind?: 'text' | 'number' | 'latin';
      badge?: { label: string; tone?: Tone; icon?: IconName };
    }[];
  }[];
  columns?: 1 | 2;
  loading?: boolean;
  loadingLabel?: string;
  emptyLabel?: string;
}

export declare const DescriptionList: (props: DescriptionListProps) => unknown;

/** A short list edited in place (A-03): a choice field's choices. Edits stay on the board. */
export interface EditableListProps {
  label: string;
  items: { id: string; label: string; use?: string; archived?: boolean }[];
  max: number;
  readOnly?: boolean;
  addError?: string;
  foot?: string;
}

export declare const EditableList: (props: EditableListProps) => unknown;
