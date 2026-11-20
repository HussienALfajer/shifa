// `cn()`: joins class lists (clsx) and lets a later class win over an earlier one of the same
// kind (tailwind-merge), told which names of the token theme are sizes, shadows or radii.
import { type ClassValue, clsx } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';
import { THEME_NAMES } from './theme-names.ts';

const merge = extendTailwindMerge({
  override: {
    theme: {
      spacing: [...THEME_NAMES.spacing],
      radius: [...THEME_NAMES.radius],
      shadow: [...THEME_NAMES.shadow],
      font: [...THEME_NAMES.font],
      text: [...THEME_NAMES.text],
      'font-weight': [...THEME_NAMES['font-weight']],
      leading: [...THEME_NAMES.leading],
      ease: [...THEME_NAMES.ease],
    },
  },
});

/** The classes of `inputs`, conflicts resolved in favour of the last one. */
export function cn(...inputs: ClassValue[]): string {
  return merge(clsx(inputs));
}
