// PageBanner stories, as on the approved sheet (owner, 2026-11-27, A02cSheetPageBanner): a warning
// and an information announcement, several in turn, the owner's notice that support is reading
// (with «إنهاء الدخول», no close), the support session's solid strip, two stacked (support first),
// and a phone width. Every story renders in the eight combinations of direction × theme × density
// and is checked by axe.
import type { Meta, StoryObj } from '@storybook/react-vite';
import { type ComponentProps, useId, useState } from 'react';
import { storyStates } from '../../.storybook/story-states.tsx';
import { people } from '../../test/fixtures.ts';
import { Button } from '../button/button.tsx';
import { PageBanner } from './page-banner.tsx';

const [AGENT] = people(1, { seed: 71 }).map((p) => p.name);
const OWNER_NOTICE = `${AGENT ?? ''} من فريق شفاء تقرأ عيادتك الآن، للقراءة فقط.`;
const TEXTS = [
  'صيانة الليلة من 11 إلى 12. احفظوا عملكم قبلها.',
  'صار بإمكانكم إضافة مدينة الفرع وحيّه من إعدادات الفروع.',
  'تدريب على جدول المواعيد الجديد يوم السبت 10:00 عبر الهاتف.',
];

/** The matrix draws each story eight times on one page: each copy's region gets its own name (axe: landmark-unique). */
function Banner(props: ComponentProps<typeof PageBanner>) {
  return <PageBanner {...props} aria-label={`${props.title} ${useId()}`} />;
}

const meta = {
  title: 'Components/PageBanner',
  component: PageBanner,
  args: { tone: 'info', title: 'معلومة:' },
  parameters: {
    docs: {
      description: {
        component:
          'A strip the width of the page above the top bar, on every page: announcements (`info`, `warning`), the owner’s notice that support is reading the clinic (`warning` with the `eye` icon and its action) and the support session’s solid strip (`support`). The bold `title` says what it is and names the region; then the text, at most one `action`, a `pager` for several announcements, and a close button (`onDismiss`) only where it can be hidden. Stack several in this order: support session, owner’s notice, announcements.\n\n**Accessibility.** A `role="region"` named by `title` (or `aria-label`). The icon is decorative; the word carries the meaning, never the colour alone. The text is a polite live region, so paging to another announcement is read; a banner is not announced on its own when the page loads. Tab reaches the pager’s buttons («الإعلان السابق», «الإعلان التالي», disabled at the ends), the action and the close button («إخفاء الإعلان», or `dismissLabel`), in that order.',
      },
    },
  },
} satisfies Meta<typeof PageBanner>;

export default meta;
type Story = StoryObj<typeof meta>;

function Several() {
  const [index, setIndex] = useState(1);
  return (
    <Banner
      tone="info"
      title="معلومة:"
      pager={{ index, count: TEXTS.length, onIndexChange: setIndex }}
      onDismiss={() => undefined}
    >
      {TEXTS[index]}
    </Banner>
  );
}

const OwnerNotice = () => (
  <Banner
    tone="warning"
    icon="eye"
    title={OWNER_NOTICE}
    action={<Button size="sm">إنهاء الدخول</Button>}
  >
    السبب: مشكلة في الفروع لا تظهر للمالك · حتى 14:12
  </Banner>
);

/** Announcements: a warning, an information, several in turn («2 من 3»). */
export const Announcements: Story = {
  render: () => (
    <div className="flex flex-col gap-4">
      <Banner tone="warning" title="تنبيه:" onDismiss={() => undefined}>
        {TEXTS[0]}
      </Banner>
      <Banner tone="info" title="معلومة:" onDismiss={() => undefined}>
        {TEXTS[1]}
      </Banner>
      <Several />
    </div>
  ),
};

/** Support: the owner's notice with «إنهاء الدخول» and the support session's solid strip; neither can be hidden. */
export const Support: Story = {
  render: () => (
    <div className="flex flex-col gap-4">
      <OwnerNotice />
      <Banner
        tone="support"
        title="دخول الدعم · للقراءة فقط"
        action={<Button size="sm">إنهاء</Button>}
      >
        عيادة تجريبية بعرض المالك · حتى 14:12 (متبقٍّ 42 دقيقة)
      </Banner>
    </div>
  ),
};

/** Two at once, support first; and a phone-wide box (400 px): the text on its line, the buttons under it. */
export const StackedAndPhone: Story = {
  render: () => (
    <div className="flex flex-col gap-4">
      <div>
        <OwnerNotice />
        <Banner tone="warning" title="تنبيه:" onDismiss={() => undefined}>
          {TEXTS[0]}
        </Banner>
      </div>
      <div className="w-(--shifa-width-100) max-w-full border border-border-default">
        <Banner tone="warning" title="تنبيه:" onDismiss={() => undefined}>
          {TEXTS[0]}
        </Banner>
        <OwnerNotice />
      </div>
    </div>
  ),
};

const states = storyStates((label) => (
  <Banner tone="info" title={label} onDismiss={() => undefined}>
    {label}
  </Banner>
));
export const LongArabicLabel: Story = states['LongArabicLabel'] ?? {};
export const MixedDirection: Story = states['MixedDirection'] ?? {};
export const Zoom200: Story = states['Zoom200'] ?? {};
export const ReducedMotion: Story = states['ReducedMotion'] ?? {};
