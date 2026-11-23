// One Icon component over a curated list (design doc, "Iconography"): Solar's Broken style (480
// Design, CC BY 4.0, vendored in ./solar with its licence) and the Healthicons tooth (CC0, in
// ./health), outline in one tone with the stroke in the text colour (OD-65). Icons that point a
// direction mirror under dir="rtl".
import { cn } from '../lib/cn.ts';
import { HEALTH_NAMES, HEALTHICONS, type IconName, SOLAR } from './sources.ts';

export type { IconName };

const files = import.meta.glob<string>(['./solar/*.svg', './health/*.svg'], {
  query: '?raw',
  import: 'default',
  eager: true,
});

/** The SVG source of every curated icon, by name. */
const SOURCES = Object.fromEntries(
  [...Object.keys(SOLAR), ...HEALTHICONS].map((name) => {
    const folder = Object.hasOwn(SOLAR, name) ? 'solar' : 'health';
    const svg = files[`./${folder}/${name}.svg`];
    if (svg === undefined) throw new Error(`@shifa/ui: src/icons/${folder}/${name}.svg is missing`);
    return [name, svg];
  }),
) as Record<IconName, string>;

/** The medical glyphs (tooth, stethoscope…), a group of the list. */
export const HEALTH_ICONS = HEALTH_NAMES;
export const ICON_NAMES = Object.keys(SOURCES) as IconName[];

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
  if (Object.hasOwn(SOURCES, name)) return SOURCES[name];
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
      // Trusted markup: the vendored files of ./solar and ./health, bundled at build time and
      // checked against their source by test/icons-vendored.test.ts; never user input.
      dangerouslySetInnerHTML={{ __html: innerOf(svg) }}
    />
  );
}
