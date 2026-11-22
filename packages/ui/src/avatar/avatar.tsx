// Avatar and avatar group (slice 0.4-07), as the owner approved the sheet on 2026-11-22 ("Shifa
// Components (proposals)", page "Data display and table · 0.4-07", OD-64). Image loading and the
// fallback come from UI SDK's Avatar; the initials, the colour and the names are ours. Sizes 24,
// 32, 40, 56 and 80 px from the avatar size tokens; six hues of the avatar palette, never red,
// chosen by a stable hash of the name, with no meaning.
import {
  Avatar as BaseAvatar,
  AvatarFallback as BaseAvatarFallback,
  AvatarImage as BaseAvatarImage,
} from '@ui-sdk/react/avatar';
import { useEffect, useState } from 'react';
import { cn } from '../lib/cn.ts';

export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

const SIZE: Record<AvatarSize, string> = {
  xs: 'size-(--shifa-size-avatar-xs) text-100',
  sm: 'size-(--shifa-size-avatar-sm) text-200',
  md: 'size-(--shifa-size-avatar-md) text-250',
  lg: 'size-(--shifa-size-avatar-lg) text-400',
  xl: 'size-(--shifa-size-avatar-xl) text-600',
};

const HUES = ['green', 'gold', 'blue', 'violet', 'cyan', 'sand'] as const;
type Hue = (typeof HUES)[number];

const HUE: Record<Hue, string> = {
  green: 'bg-avatar-green-bg text-avatar-green-fg',
  gold: 'bg-avatar-gold-bg text-avatar-gold-fg',
  blue: 'bg-avatar-blue-bg text-avatar-blue-fg',
  violet: 'bg-avatar-violet-bg text-avatar-violet-fg',
  cyan: 'bg-avatar-cyan-bg text-avatar-cyan-fg',
  sand: 'bg-avatar-sand-bg text-avatar-sand-fg',
};

/** Titles that come before a name and are not part of it. */
const TITLES = new Set(['د.', 'د', 'أ.', 'م.', 'Dr.', 'Dr']);
const LATIN = /^[A-Za-z]/;

/** The words of a name, without titles, «ال» taken off the front of each Arabic word. */
function nameWords(name: string): string[] {
  return name
    .split(/\s+/)
    .filter((word) => word !== '' && !TITLES.has(word))
    .map((word) => (word.startsWith('ال') && word.length > 2 ? word.slice(2) : word));
}

/**
 * The initials an avatar shows for `name`: the first letters of the first and last names
 * («س خ»), a space between Arabic letters so each stands alone, two capitals for a Latin name
 * («RS»), one letter for a single name. «ال» and titles such as «د.» are skipped.
 */
export function avatarInitials(name: string): string {
  const words = nameWords(name);
  const first = words[0];
  if (first === undefined) return '';
  const last = words.length > 1 ? words[words.length - 1] : undefined;
  const letters = [first, last].filter((w): w is string => w !== undefined).map((w) => w.charAt(0));
  return LATIN.test(first) ? letters.join('').toUpperCase() : letters.join(' ');
}

/** A stable hue for `name` (FNV-1a over its characters). */
function hueOf(name: string): Hue {
  let hash = 0x811c9dc5;
  for (const ch of name.trim()) {
    hash ^= ch.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return HUES[hash % HUES.length] ?? 'green';
}

/**
 * The `src` that has finished loading, or null: the picture enters the page only once it loaded,
 * so a slow or broken one never shows as a broken image (the initials stand meanwhile).
 */
function useLoaded(src: string | undefined): string | null {
  const [loaded, setLoaded] = useState<string | null>(null);
  useEffect(() => {
    if (src === undefined) return undefined;
    let live = true;
    const probe = new Image();
    probe.onload = () => {
      if (live) setLoaded(src);
    };
    probe.onerror = () => {
      if (live) setLoaded(null);
    };
    probe.src = src;
    return () => {
      live = false;
    };
  }, [src]);
  return loaded;
}

export interface AvatarProps {
  /** The person's full name: the accessible name, the initials and the colour come from it. */
  name: string;
  /** The picture; while it loads, or when it fails, the initials show. */
  src?: string | undefined;
  /** xs 24, sm 32, md 40 (default), lg 56, xl 80 px. */
  size?: AvatarSize;
  className?: string;
}

export function Avatar({ name, src, size = 'md', className }: AvatarProps) {
  const hue = hueOf(name);
  const initials = avatarInitials(name);
  const latin = LATIN.test(initials);
  const loaded = useLoaded(src);
  return (
    <BaseAvatar
      role="img"
      aria-label={name}
      data-hue={hue}
      className={cn(
        'relative inline-flex shrink-0 select-none items-center justify-center overflow-hidden rounded-full',
        'font-ui leading-none font-semibold',
        SIZE[size],
        HUE[hue],
        className,
      )}
    >
      {src !== undefined && loaded === src && (
        <BaseAvatarImage src={src} alt="" className="size-full object-cover" />
      )}
      <BaseAvatarFallback aria-hidden="true">
        {latin ? <bdi>{initials}</bdi> : initials}
      </BaseAvatarFallback>
    </BaseAvatar>
  );
}

export interface AvatarGroupPerson {
  id: string;
  name: string;
  src?: string | undefined;
}

export interface AvatarGroupProps {
  /** What the group is: «الأطباء المناوبون». */
  label: string;
  people: readonly AvatarGroupPerson[];
  /** How many avatars show before the count of the rest. */
  max?: number;
  size?: AvatarSize;
  /** How the rest is read: «و3 آخرون» by default. */
  moreLabel?: (count: number) => string;
}

const moreDefault = (count: number) => `و${String(count)} آخرون`;

/** A row of avatars that overlap toward the logical end, with the count of the rest. */
export function AvatarGroup({
  label,
  people,
  max = 3,
  size = 'sm',
  moreLabel = moreDefault,
}: AvatarGroupProps) {
  const shown = people.slice(0, max);
  const rest = people.length - shown.length;
  const ring = 'ring-2 ring-bg-surface';
  return (
    <div role="group" aria-label={label} className="inline-flex items-center">
      {shown.map((person, i) => (
        <Avatar
          key={person.id}
          name={person.name}
          src={person.src}
          size={size}
          className={cn(ring, i > 0 && '-ms-2')}
        />
      ))}
      {rest > 0 && (
        <span
          role="img"
          aria-label={moreLabel(rest)}
          className={cn(
            'relative -ms-2 inline-flex shrink-0 items-center justify-center rounded-full border border-border-default',
            'bg-bg-surface-raised font-ui leading-none font-semibold text-text-default tabular-nums',
            SIZE[size],
            ring,
          )}
        >
          <span aria-hidden="true">{`+${String(rest)}`}</span>
        </span>
      )}
    </div>
  );
}
