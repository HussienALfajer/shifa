// One Icon component over a curated list (design doc, "Iconography"): Phosphor (MIT) drawn
// duotone, the second tone at 20 % of the stroke, and a small Healthicons set (CC0) for medical
// glyphs, kept as files in ./health. Icons that point a direction mirror under dir="rtl".
import { cn } from '../lib/cn.ts';
import bloodDrop from './health/blood-drop.svg?raw';
import heartOrgan from './health/heart-organ.svg?raw';
import medicines from './health/medicines.svg?raw';
import stethoscope from './health/stethoscope.svg?raw';
import syringe from './health/syringe.svg?raw';
import tooth from './health/tooth.svg?raw';
import { PHOSPHOR, type PhosphorIcon } from './phosphor.ts';

/** Healthicons (outline, 24 px grid), as their SVG source. */
const HEALTH = {
  'blood-drop': bloodDrop,
  'heart-organ': heartOrgan,
  medicines,
  stethoscope,
  syringe,
  tooth,
} satisfies Record<string, string>;

export type IconName = keyof typeof PHOSPHOR | keyof typeof HEALTH;

export const HEALTH_ICONS = Object.keys(HEALTH) as (keyof typeof HEALTH)[];
export const ICON_NAMES = [...Object.keys(PHOSPHOR), ...HEALTH_ICONS] as IconName[];

/** Icons that point along the line; they mirror in RTL. Clocks, media and logos never do. */
export const DIRECTIONAL_ICONS: readonly IconName[] = [
  'arrow-back',
  'arrow-forward',
  'caret-back',
  'caret-forward',
  'sign-out',
];

type Source = { kind: 'phosphor'; component: PhosphorIcon } | { kind: 'health'; svg: string };

/** What draws `name`; throws for a name outside the curated list. */
export function iconSource(name: IconName): Source {
  if (Object.hasOwn(PHOSPHOR, name)) {
    return { kind: 'phosphor', component: PHOSPHOR[name as keyof typeof PHOSPHOR] };
  }
  if (Object.hasOwn(HEALTH, name)) {
    return { kind: 'health', svg: HEALTH[name as keyof typeof HEALTH] };
  }
  throw new Error(`@shifa/ui: "${name}" is not in the icon list (src/icons/icon.tsx)`);
}

/** The inner markup of an SVG file, without its <svg> element. */
const innerOf = (svg: string) => svg.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');

const SIZE = { sm: 'size-(--shifa-size-icon-sm)', md: 'size-(--shifa-size-icon-md)' } as const;

export interface IconProps {
  name: IconName;
  /** sm 20 px (rows and controls, the default), md 24 px (navigation and cards). */
  size?: keyof typeof SIZE;
  /** A name for screen readers; without it the icon is decorative and hidden from them. */
  label?: string | undefined;
  className?: string | undefined;
}

export function Icon({ name, size = 'sm', label, className }: IconProps) {
  const source = iconSource(name);
  const a11y =
    label === undefined
      ? { 'aria-hidden': true as const }
      : { role: 'img' as const, 'aria-label': label };
  const classes = cn(
    'inline-block shrink-0',
    SIZE[size],
    DIRECTIONAL_ICONS.includes(name) && 'rtl:-scale-x-100',
    className,
  );
  if (source.kind === 'phosphor') {
    const Glyph = source.component;
    return <Glyph weight="duotone" focusable="false" className={classes} {...a11y} />;
  }
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      focusable="false"
      className={classes}
      {...a11y}
      // Trusted markup: the CC0 files of ./health, bundled at build time; never user input.
      dangerouslySetInnerHTML={{ __html: innerOf(source.svg) }}
    />
  );
}
