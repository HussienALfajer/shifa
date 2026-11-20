// The text states every text-bearing component shows (spec 0.4, edge cases): a long Arabic label,
// a mixed-direction label, 200 % zoom and reduced motion. Labels use synthetic names only.
import { createRandom, fullName, generatePersonName } from '@shifa/testing';
import type { StoryObj } from '@storybook/react-vite';
import type { CSSProperties, ReactElement } from 'react';

const NAME = fullName(
  generatePersonName(createRandom(4031), { sex: 'female', adult: true, region: 'azaz' }),
);

/** The labels the text states use: a long Arabic one (with a synthetic name) and a mixed one. */
export const TEXT_STATES = {
  long: `إرسال ${NAME} إلى غرفة الطبيب وتأكيد الحضور`,
  mixed: 'تصدير PDF',
} as const;

type Render = (label: string) => ReactElement;

/** Fixture geometry, not a design value: the width of a narrow column. */
const NARROW: CSSProperties = { width: 256 };

/** Four stories of `render`: LongArabicLabel, MixedDirection, Zoom200 and ReducedMotion. */
export function storyStates(render: Render): Record<string, StoryObj> {
  return {
    LongArabicLabel: {
      name: 'نص طويل (Long Arabic label)',
      // 256 px: a narrow card column, where the label must wrap.
      render: () => <div style={NARROW}>{render(TEXT_STATES.long)}</div>,
    },
    MixedDirection: {
      name: 'نص مختلط الاتجاه (Mixed direction)',
      render: () => render(TEXT_STATES.mixed),
    },
    Zoom200: {
      name: 'تكبير 200 % (200 % zoom)',
      render: () => <div style={{ zoom: 2 }}>{render('حفظ')}</div>,
    },
    ReducedMotion: {
      name: 'حركة مخففة (Reduced motion)',
      render: () => <div data-motion="reduce">{render('حفظ')}</div>,
    },
  };
}
