// Badge stories, as on the approved sheet (owner, 2026-11-22, OD-64). Every story renders in the
// eight combinations of direction × theme × density and is checked by axe.
import type { Meta, StoryObj } from '@storybook/react-vite';
import { storyStates } from '../../.storybook/story-states.tsx';
import { Badge, CountBadge } from './badge.tsx';

const meta = {
  title: 'Components/Badge',
  component: Badge,
  parameters: {
    docs: {
      description: {
        component:
          'A small mark that is never pressed. neutral, brand and outline follow the clinic’s theme; the status tones (success, warning, danger, info) and the visit-queue tones use the locked colours and always carry an icon besides their word. Sizes sm 24 and md 28. CountBadge shows a count on a tab or menu item (Western tabular digits, 99+ at most, nothing at 0) read by its label, or a dot.\n\n**Accessibility.** A Badge is a plain `span` of text with no role; its icon is hidden (`aria-hidden`) and screen readers read only its word, so the word must say the state on its own. It has no keyboard interaction: a badge is never focused or pressed. CountBadge needs a `label`: the visible number is hidden and the label («12 رسالة غير مقروءة») is read in its place; a dot is a `role="img"` named by its label.',
      },
    },
  },
  args: { children: 'مسودة' },
} satisfies Meta<typeof Badge>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Themed tones in both sizes. */
export const Themed: Story = {
  render: () => (
    <div className="flex flex-col items-start gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <Badge>مسودة</Badge>
        <Badge tone="brand">أسنان</Badge>
        <Badge tone="outline">تأمين خاص</Badge>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Badge size="md">مسودة</Badge>
        <Badge size="md" tone="brand">
          أسنان
        </Badge>
        <Badge size="md" tone="outline" icon="file-text">
          تأمين خاص
        </Badge>
      </div>
    </div>
  ),
};

/** Status and visit-queue tones: locked colours, an icon and a word. */
export const Status: Story = {
  render: () => (
    <div className="flex flex-col items-start gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <Badge tone="success">مدفوعة</Badge>
        <Badge tone="warning">جزئية</Badge>
        <Badge tone="danger">ملغاة</Badge>
        <Badge tone="info">مرسلة</Badge>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Badge tone="queue-booked">محجوز</Badge>
        <Badge tone="queue-confirmed">مؤكد</Badge>
        <Badge tone="queue-arrived">وصل</Badge>
        <Badge tone="queue-waiting">بالانتظار</Badge>
        <Badge tone="queue-in-room">في الغرفة</Badge>
        <Badge tone="queue-done">انتهت</Badge>
        <Badge tone="queue-no-show">لم يحضر</Badge>
        <Badge tone="queue-cancelled">ملغى</Badge>
      </div>
    </div>
  ),
};

/** Counts beside labels, the cap, and a dot. */
export const Counts: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-6 font-ui text-body">
      <span className="inline-flex items-center gap-2">
        بالانتظار <CountBadge tone="brand" count={5} label="5 بالانتظار" />
      </span>
      <span className="inline-flex items-center gap-2">
        الرسائل <CountBadge tone="danger" count={12} label="12 رسالة غير مقروءة" />
      </span>
      <span className="inline-flex items-center gap-2">
        الكل <CountBadge count={140} label="140 زيارة" />
      </span>
      <span className="inline-flex items-center gap-2">
        الإشعارات <CountBadge dot label="إشعارات جديدة" />
      </span>
    </div>
  ),
};

const states = storyStates((label) => (
  <div className="flex flex-wrap items-center gap-3">
    <Badge tone="info">{label}</Badge>
    <Badge>{label}</Badge>
  </div>
));
export const LongArabicLabel: Story = states['LongArabicLabel'] ?? {};
export const MixedDirection: Story = states['MixedDirection'] ?? {};
export const Zoom200: Story = states['Zoom200'] ?? {};
export const ReducedMotion: Story = states['ReducedMotion'] ?? {};
