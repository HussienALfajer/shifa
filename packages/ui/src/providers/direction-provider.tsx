import { createContext, type ReactNode, useContext } from 'react';

export type Direction = 'rtl' | 'ltr';

const DirectionContext = createContext<Direction>('rtl');

/**
 * Sets the writing direction and language of everything inside. Arabic RTL is the default
 * (design principle 5); UI SDK components read the direction from the `dir` attribute.
 */
export function DirectionProvider({
  dir = 'rtl',
  lang = dir === 'rtl' ? 'ar' : 'en',
  children,
}: {
  dir?: Direction;
  lang?: string;
  children: ReactNode;
}) {
  return (
    <DirectionContext value={dir}>
      <div dir={dir} lang={lang} className="contents">
        {children}
      </div>
    </DirectionContext>
  );
}

/** The writing direction in effect here. */
export function useDirection(): Direction {
  return useContext(DirectionContext);
}
