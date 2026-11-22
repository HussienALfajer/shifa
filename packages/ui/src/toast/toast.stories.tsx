// Toast stories, as on the approved sheet (owner, 2026-11-22). The region is fixed to the screen's
// bottom corner, so the toasts are shown by play stories (one region per story); the trigger
// renders in the eight combinations of direction × theme × density.
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { storyStates } from '../../.storybook/story-states.tsx';
import { Button } from '../button/button.tsx';
import { type ToastOptions, ToastProvider, useToast } from './toast.tsx';

const meta = {
  title: 'Components/Toast',
  component: ToastProvider,
  parameters: {
    docs: {
      description: {
        component:
          'A short message after something happened. One `ToastProvider` per app; `useToast().show({ type, title, description, action })`. Bottom, at the logical end (the bottom left in Arabic); three at most, the newest at the bottom, the rest wait. Success and info close after 5 s, warning after 8 s, errors stay until closed. Announced politely, errors at once; timers pause on hover and focus.',
      },
    },
  },
  args: { children: null },
} satisfies Meta<typeof ToastProvider>;

export default meta;
type Story = StoryObj<typeof meta>;

const STATUSES: ToastOptions[] = [
  { type: 'success', title: 'حُفظت الوصفة', description: 'ثلاثة أدوية', duration: Infinity },
  {
    type: 'info',
    title: 'نُقل الموعد إلى الخميس 26/11',
    action: { label: 'تراجع' },
    duration: Infinity,
  },
  {
    type: 'warning',
    title: 'لم يُرسل التذكير بعد',
    description: 'سيُعاد الإرسال عند عودة الاتصال',
    duration: Infinity,
  },
];

function Trigger({
  toasts,
  label = 'إظهار الإشعارات',
}: {
  toasts: ToastOptions[];
  label?: string;
}) {
  const toast = useToast();
  return (
    <Button
      onClick={() => {
        for (const options of toasts) toast.show(options);
      }}
    >
      {label}
    </Button>
  );
}

function Page({ toasts = STATUSES, label }: { toasts?: ToastOptions[]; label?: string }) {
  return (
    <ToastProvider>
      <Trigger toasts={toasts} {...(label === undefined ? {} : { label })} />
    </ToastProvider>
  );
}

async function showAll(canvasElement: HTMLElement, count: number) {
  await userEvent.click(within(canvasElement).getByRole('button'));
  await waitFor(async () => {
    const shown = canvasElement.ownerDocument.querySelectorAll(
      '[data-slot="toast"]:not([data-ending-style])',
    );
    await expect(shown.length).toBe(count);
  });
}

/** The trigger at rest. */
export const Default: Story = { render: () => <Page /> };

/** Success, info with an action, warning: three at the bottom corner. */
export const Statuses: Story = {
  parameters: { matrix: false },
  render: () => <Page />,
  play: async ({ canvasElement }) => {
    await showAll(canvasElement, 3);
  },
};

/** An error stays until it is closed, with a retry. */
export const ErrorToast: Story = {
  parameters: { matrix: false },
  render: () => (
    <Page
      toasts={[
        {
          type: 'error',
          title: 'تعذّر حفظ الفاتورة',
          description: 'تحقق من الاتصال ثم حاول مجدداً',
          action: { label: 'إعادة المحاولة' },
        },
      ]}
    />
  ),
  play: async ({ canvasElement }) => {
    await showAll(canvasElement, 1);
  },
};

const states = storyStates((label) => <Page label={label} />);
export const LongArabicLabel: Story = states['LongArabicLabel'] ?? {};
export const MixedDirection: Story = states['MixedDirection'] ?? {};
export const Zoom200: Story = states['Zoom200'] ?? {};
export const ReducedMotion: Story = states['ReducedMotion'] ?? {};
