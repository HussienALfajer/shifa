// One Icon component over a curated list (design doc, "Iconography"): Tabler Icons (MIT),
// outline, one tone, the stroke in the text colour (OD-65), medical glyphs included. Icons that
// point a direction mirror under dir="rtl".
import { cn } from '../lib/cn.ts';
import { GLYPHS, type GlyphName, HEALTH_GLYPHS, type TablerIcon } from './tabler.ts';

export type IconName = GlyphName;

/** The medical glyphs (tooth, stethoscope…), a group of the list. */
export const HEALTH_ICONS = Object.keys(HEALTH_GLYPHS) as (keyof typeof HEALTH_GLYPHS)[];
export const ICON_NAMES = Object.keys(GLYPHS) as IconName[];

/** Icons that point along the line; they mirror in RTL. Clocks, media and logos never do. */
export const DIRECTIONAL_ICONS: readonly IconName[] = [
  'arrow-back',
  'arrow-forward',
  'caret-back',
  'caret-forward',
  'sign-out',
];

/** What draws `name`; throws for a name outside the curated list. */
export function iconSource(name: IconName): TablerIcon {
  if (Object.hasOwn(GLYPHS, name)) return GLYPHS[name];
  throw new Error(`@shifa/ui: "${name}" is not in the icon list (src/icons/tabler.ts)`);
}

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
  const Glyph = iconSource(name);
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
  // Tabler's 24 px width and height attributes are overridden by the size class.
  return <Glyph focusable="false" className={classes} {...a11y} />;
}
