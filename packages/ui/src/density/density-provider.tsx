import { createContext, type ReactNode, useContext, useEffect, useSyncExternalStore } from 'react';
import { COARSE_POINTER, type Density, resolveDensity } from './resolve.ts';

const DensityContext = createContext<Density>('comfortable');

const unsubscribed = () => undefined;

function subscribe(onChange: () => void): () => void {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return unsubscribed;
  const query = window.matchMedia(COARSE_POINTER);
  query.addEventListener('change', onChange);
  return () => {
    query.removeEventListener('change', onChange);
  };
}

const isCoarse = () =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia(COARSE_POINTER).matches;

/** True while the main pointer is coarse (a touch screen). */
export function useCoarsePointer(): boolean {
  return useSyncExternalStore(subscribe, isCoarse, () => false);
}

/**
 * Sets the density of everything inside (`data-density`). `compact` is refused on a coarse
 * pointer, where its 32 px rows are too small to touch: the region falls back to comfortable
 * and a development warning names the refusal.
 */
export function DensityProvider({
  density: requested,
  children,
}: {
  density: Density;
  children: ReactNode;
}) {
  const { density, refused } = resolveDensity(requested, { coarsePointer: useCoarsePointer() });
  useEffect(() => {
    if (refused && import.meta.env?.DEV === true) {
      // eslint-disable-next-line no-console -- a development warning, never shipped as an error
      console.warn(
        '[@shifa/ui] compact density refused on a coarse pointer; using comfortable (44 px targets).',
      );
    }
  }, [refused]);
  return (
    <DensityContext value={density}>
      <div data-density={density} className="contents">
        {children}
      </div>
    </DensityContext>
  );
}

/** The density in effect here. */
export function useDensity(): Density {
  return useContext(DensityContext);
}
