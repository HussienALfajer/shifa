// Search folding for the command palette (slice 0.4-06; since slice 0.4-12 the shared Arabic
// folding of OD-40, `foldArabic`, also used by Combobox and Select). Phase A may pass the full
// name normaliser (ADR-0034) through `normalise`.
import { createElement, Fragment, type ReactNode } from 'react';
import { foldArabic, foldedMatch } from '../lib/fold-arabic.ts';

/** The palette's default matching: the shared Arabic folding (OD-40). */
export const normaliseForSearch: (text: string) => string = foldArabic;

/**
 * `label` with the part matching `query` in a <mark>, compared through `normalise` one character
 * at a time (so a removed diacritic or a folded alef keeps its place in the original). A rule of
 * `normalise` that spans several characters marks nothing, and the label shows as it is.
 */
export function highlight(
  label: string,
  query: string,
  normalise: (text: string) => string,
): ReactNode {
  const match = foldedMatch(label, query, { normalise });
  if (match === null) return label;
  return createElement(
    Fragment,
    null,
    label.slice(0, match.start),
    createElement(
      'mark',
      { className: 'rounded-xs bg-brand-accent-soft font-semibold text-text-default' },
      label.slice(match.start, match.end),
    ),
    label.slice(match.end),
  );
}
