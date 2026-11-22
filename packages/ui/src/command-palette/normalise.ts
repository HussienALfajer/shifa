// Text folding for the command palette (slice 0.4-06): a simple default so an Arabic query finds
// a name whatever its diacritics, tatweel or alef form. Phase A passes the full name normaliser
// (ADR-0034, OD-40) through `normalise`; this one is not it.
import { createElement, Fragment, type ReactNode } from 'react';
import { toWesternDigits } from '../lib/digits.ts';

/** Harakat, shadda, sukun, superscript alef and the Quranic marks. */
const DIACRITICS = /[ً-ٰٟۖ-ۭ]/g;
const TATWEEL = /ـ/g;
/** Alef with hamza above or below, with madda, and wasla, folded to a bare alef. */
const ALEF_FORMS = /[آأإٱ]/g;

/** Lower case, no diacritics or tatweel, one alef form, Western digits (OD-20). */
export function normaliseForSearch(text: string): string {
  return toWesternDigits(text)
    .toLocaleLowerCase()
    .replace(DIACRITICS, '')
    .replace(TATWEEL, '')
    .replace(ALEF_FORMS, 'ا');
}

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
  const wanted = normalise(query.trim());
  if (wanted === '') return label;
  // One UTF-16 unit at a time: Arabic letters and their marks are each one unit.
  let folded = '';
  const origin: number[] = [];
  for (let index = 0; index < label.length; index++) {
    const out = normalise(label.charAt(index));
    folded += out;
    origin.push(...Array.from({ length: out.length }, () => index));
  }
  const at = folded.indexOf(wanted);
  const start = origin[at];
  const last = origin[at + wanted.length - 1];
  if (at === -1 || start === undefined || last === undefined) return label;
  let end = last + 1;
  // Marks after the last matched letter (its diacritics) belong to it.
  while (end < label.length && normalise(label.charAt(end)) === '') end++;
  return createElement(
    Fragment,
    null,
    label.slice(0, start),
    createElement(
      'mark',
      { className: 'rounded-xs bg-brand-accent-soft font-semibold text-text-default' },
      label.slice(start, end),
    ),
    label.slice(end),
  );
}
