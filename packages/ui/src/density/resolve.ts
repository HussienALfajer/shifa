// Density: `comfortable` (touch, 44 px targets) or `compact` (desktop data screens, 32 px rows).
// Compact rows are below the touch target, so a coarse pointer always gets comfortable (design
// doc, "Density"; slice 0.4-03).
export const DENSITIES = ['comfortable', 'compact'] as const;
export type Density = (typeof DENSITIES)[number];

/** The media query of a touch screen as the main pointer. */
export const COARSE_POINTER = '(pointer: coarse)';

/** The density to use for `requested`, and whether a compact request was refused. */
export function resolveDensity(
  requested: Density,
  { coarsePointer }: { coarsePointer: boolean },
): { density: Density; refused: boolean } {
  if (requested === 'compact' && coarsePointer) return { density: 'comfortable', refused: true };
  return { density: requested, refused: false };
}
