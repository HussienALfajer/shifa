// The data of RecordList (A-03-01, sheet A03SheetRecordList).
import type { BadgeTone } from '../badge/badge.tsx';
import type { ButtonVariant } from '../button/button.tsx';
import type { IconName } from '../icons/icon.tsx';

export type RecordListLayout = 'table' | 'stack' | 'tiles';
export type RecordListSize = 'md' | 'sm';

/** A column of the table layout; its header is also read before each of its cells. */
export interface RecordListColumn {
  header: string;
  /** Its share of the width against the title's 2.6 (default 1). */
  weight?: number | undefined;
}

/** A cell of a row, one per column: `number` (tabular, heavier), `latin` (isolated LTR), `muted`. */
export interface RecordListCell {
  text: string;
  kind?: 'text' | 'number' | 'latin' | 'muted' | undefined;
  icon?: IconName | undefined;
}

/** A piece of the second line: a short text, or a badge. */
export type RecordListDetail =
  | { text: string; kind?: 'text' | 'latin' | undefined }
  | { badge: string; tone?: BadgeTone | undefined; icon?: IconName | undefined };

export interface RecordListTool {
  icon: IconName;
  /** Its name, also its tooltip («نقل «جهة الإحالة» للأعلى»). */
  label: string;
  onClick: () => void;
  disabled?: boolean | undefined;
}

export interface RecordListItem {
  id: string;
  title: string;
  /** The indexes of the title's words that matched the search, shown heavier. */
  matches?: readonly number[] | undefined;
  /** The avatar's name when it differs from the title («د. …»). */
  avatarName?: string | undefined;
  avatarSrc?: string | undefined;
  /** A type icon in place of the avatar (a field's type). */
  icon?: IconName | undefined;
  details?: readonly RecordListDetail[] | undefined;
  cells?: readonly RecordListCell[] | undefined;
  /** The record's page: the whole row is the link. */
  href?: string | undefined;
  /** A button at the end; the row is then not a link. */
  action?: { label: string; onClick: () => void; variant?: ButtonVariant | undefined } | undefined;
  /** Small tool buttons at the end, before the action. */
  tools?: readonly RecordListTool[] | undefined;
  /** A badge at the end, when there is no action («غير نشطة»). */
  badge?: { label: string; tone?: BadgeTone | undefined; icon?: IconName | undefined } | undefined;
  /** A record the viewer may not see: no avatar, no link; the title says what it is. */
  locked?: boolean | undefined;
  /** The lock's name for screen readers (default «مخفي عنك»). */
  lockedLabel?: string | undefined;
  /** Archived: muted. */
  dim?: boolean | undefined;
  /** The selected row (`aria-current`). */
  current?: boolean | undefined;
}
