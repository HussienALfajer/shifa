// One Icon component over a curated list (design doc, "Iconography"): Solar's Broken style (480
// Design, CC BY 4.0, licence in ./solar) and the Healthicons tooth (CC0, ./health), outline in
// one tone with the stroke in the text colour (OD-65). The SVG sources come from a generated plain
// module, so any bundler can load the package. Icons that point a direction mirror under
// dir="rtl".
import { cn } from '../lib/cn.ts';
import { ICON_SVG } from './generated/icons.ts';
import { HEALTH_NAMES, type IconName } from './sources.ts';

export type { IconName };

/** The medical glyphs (tooth, stethoscope…), a group of the list. */
export const HEALTH_ICONS = HEALTH_NAMES;
export const ICON_NAMES = Object.keys(ICON_SVG) as IconName[];

/** Icons that point along the line; they mirror in RTL. Clocks, media and logos never do. */
export const DIRECTIONAL_ICONS: readonly IconName[] = [
  'arrow-back',
  'arrow-forward',
  'caret-back',
  'caret-forward',
  'sign-out',
];

/** The SVG source of `name`; throws for a name outside the curated list. */
export function iconSource(name: IconName): string {
  if (Object.hasOwn(ICON_SVG, name)) return ICON_SVG[name];
  throw new Error(`@shifa/ui: "${name}" is not in the icon list (src/icons/sources.ts)`);
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
  const svg = iconSource(name);
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
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      focusable="false"
      data-shifa-icon={name}
      className={classes}
      {...a11y}
      // Trusted markup: the generated module of Solar and Healthicons sources, written at build
      // time and checked against them by test/icons-vendored.test.ts; never user input.
      dangerouslySetInnerHTML={{ __html: innerOf(svg) }}
    />
  );
}
