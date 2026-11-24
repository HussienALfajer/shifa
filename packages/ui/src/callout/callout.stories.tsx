// Callout stories, as on the approved sheet (owner, 2026-11-24, `CalloutSheet`, ADR-0046). Every
// story renders in the eight combinations of direction × theme × density and is checked by axe.
import type { Meta, StoryObj } from '@storybook/react-vite';
import { storyStates } from '../../.storybook/story-states.tsx';
import { Button } from '../button/button.tsx';
import { Callout } from './callout.tsx';

const meta = {
  title: 'Components/Callout',
  component: Callout,
  parameters: {
    docs: {
      description: {
        component:
          'A message inside the page that stays while its cause holds: a lock with its countdown, a blocked network, a server out of reach, a session that ended, a suspended clinic. Under the page title and above the fields; not a Toast (that passes), not a field error, not an AlertDialog (it asks nothing). Four tones in the locked status colours, each with its icon (replaceable with `icon`), an optional `title`, one or two sentences and at most one `action` button at the end of the line; no close button, it goes when its cause does.\n\n**Accessibility.** warning and danger have `role="alert"`, info and success `role="status"`, so a screen reader reads the message once when it appears (render it after the action that caused it). No keyboard interaction of its own: Tab reaches only the action button. The icon is decorative and hidden (`aria-hidden`); the words carry the meaning, never the colour alone. A live region re-reads text that changes: put a ticking countdown in an `aria-hidden` span and give screen readers a fixed sentence (the end time) in an `sr-only` span, so it is not announced each second.',
      },
    },
  },
  args: { children: 'ادخل من جديد لتتابع.' },
} satisfies Meta<typeof Callout>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The sheet's rows: sign-out notice, recovery code, lock, no connection, suspended, text only. */
export const Tones: Story = {
  render: () => (
    <div className="flex flex-col gap-4">
      <Callout tone="info" icon="clock" title="خرجت تلقائياً">
        مرّت 30 دقيقة دون نشاط فأغلقنا الجلسة. ادخل من جديد لتتابع.
      </Callout>
      <Callout tone="success" title="دخلت برمز استرداد · بقي لديك 9 رموز">
        الرمز الذي استعملته أُلغي.
      </Callout>
      <Callout tone="warning" icon="clock" title="توقّف الدخول بهذا الرقم مؤقتاً">
        بعد 5 محاولات خاطئة. يمكنك المحاولة بعد <span className="tabular-nums">14:59</span> (الساعة
        10:42).
      </Callout>
      <Callout
        tone="danger"
        icon="wifi-slash"
        title="تعذّر الوصول إلى الخادم"
        action={
          <Button size="sm" variant="secondary">
            إعادة المحاولة
          </Button>
        }
      >
        تأكد من الاتصال بالإنترنت.
      </Callout>
      <Callout tone="warning" title="حساب هذه العيادة موقوف الآن">
        بياناتها محفوظة. اختر عيادة أخرى أو تواصل مع إدارة شفاء.
      </Callout>
      <Callout>
        هنا يُحوَّل الرابط إلى صفحة الدعوة بالرمز نفسه دون أن يظهر في العنوان، وتبقى الرسالة ما دام
        سببها قائماً مهما طال النص.
      </Callout>
    </div>
  ),
};

const states = storyStates((label) => (
  <Callout tone="warning" title={label}>
    {label}
  </Callout>
));
export const LongArabicLabel: Story = states['LongArabicLabel'] ?? {};
export const MixedDirection: Story = states['MixedDirection'] ?? {};
export const Zoom200: Story = states['Zoom200'] ?? {};
export const ReducedMotion: Story = states['ReducedMotion'] ?? {};
