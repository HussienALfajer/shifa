// Empty state stories, as on the approved sheet (owner, 2026-11-22, OD-64). Every story renders in
// the eight combinations of direction × theme × density and is checked by axe.
import type { Meta, StoryObj } from '@storybook/react-vite';
import { storyStates } from '../../.storybook/story-states.tsx';
import { Button } from '../button/button.tsx';
import { EmptyState } from './empty-state.tsx';

const meta = {
  title: 'Components/EmptyState',
  component: EmptyState,
  parameters: {
    docs: {
      description: {
        component:
          'Says what is empty or what went wrong and the next step: a line drawing (jasmine or the eight-point star with the gold dot) or an icon for search and errors, a title, a description and up to two actions. panel inside a card or table, page for a whole empty screen. The text is the caller’s.\n\n**Accessibility.** The title is a real heading (`h3` by default; set `headingLevel` from 1 to 4 to fit the page outline; 1 when the empty state is the whole page and its title the page’s only `h1`, which looks the same) and the description a paragraph. No keyboard interaction of its own: Tab reaches only the action buttons the caller passes. The drawing and the icon are decorative and hidden from screen readers (`aria-hidden`), so the title must say what happened. It is not a live region: shown after a search or a failed load, it is not announced on its own.',
      },
    },
  },
  args: { title: 'لا مواعيد اليوم' },
} satisfies Meta<typeof EmptyState>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Panel size: an empty day, a search without results, a load that failed. */
export const Panel: Story = {
  render: () => (
    <div className="grid grid-cols-1 gap-4">
      <EmptyState
        art="jasmine"
        title="لا مواعيد اليوم"
        description="لم يُحجز أي موعد ليوم الأحد 22/11/2026."
        actions={<Button variant="primary">موعد جديد</Button>}
      />
      <EmptyState
        icon="magnifying-glass"
        title="لا نتائج"
        description="جرّب اسماً آخر أو رقم الهاتف أو رقم الملف."
        actions={<Button>مسح البحث</Button>}
      />
      <EmptyState
        icon="warning"
        title="تعذّر تحميل الفواتير"
        description="انقطع الاتصال بالخادم. ما حُفظ على الجهاز لم يضِع."
        actions={
          <>
            <Button variant="primary">إعادة المحاولة</Button>
            <Button variant="ghost">التفاصيل</Button>
          </>
        }
      />
    </div>
  ),
};

/** Page size, with two actions; a whole empty screen, so its title is the page's h1. */
export const Page: Story = {
  render: () => (
    <EmptyState
      art="star"
      size="page"
      headingLevel={1}
      title="لا مرضى بعد"
      description="أضف أول مريض أو استورد قائمة المرضى من ملف."
      actions={
        <>
          <Button variant="primary">إضافة مريض</Button>
          <Button>استيراد</Button>
        </>
      }
    />
  ),
};

const states = storyStates((label) => (
  <EmptyState art="jasmine" title={label} description={label} />
));
export const LongArabicLabel: Story = states['LongArabicLabel'] ?? {};
export const MixedDirection: Story = states['MixedDirection'] ?? {};
export const Zoom200: Story = states['Zoom200'] ?? {};
export const ReducedMotion: Story = states['ReducedMotion'] ?? {};
