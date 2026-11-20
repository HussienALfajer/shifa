// Combobox stories, as on the approved sheet (owner, 2026-11-20). The field renders in the eight
// combinations; the open suggestions and the empty state are stories of their own, typed by
// their play functions. Names come from the synthetic generator in @shifa/testing.
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { storyStates } from '../../.storybook/story-states.tsx';
import { patientsSharing } from '../../test/fixtures.ts';
import { Combobox, type ComboboxItem } from './combobox.tsx';

const { query, matching, others } = patientsSharing();
const ITEMS: ComboboxItem[] = [...matching, ...others].map((p) => ({
  value: p.id,
  label: p.name,
  description: `ملف ${p.id}`,
}));

const meta = {
  title: 'Components/Combobox',
  component: Combobox,
  args: {
    label: 'المريض',
    items: ITEMS,
    emptyMessage: 'لا يوجد مريض بهذا الاسم',
    placeholder: 'ابحث بالاسم',
  },
  parameters: {
    docs: {
      description: {
        component:
          'Search a long list as you type: a name matches when one of its words starts with the typed text; the typed part is bold. Focus stays in the field; Down and Up move, Enter chooses, Escape closes. Say what happens when nothing matches (`emptyMessage`).',
      },
    },
  },
} satisfies Meta<typeof Combobox>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Empty, chosen, invalid and disabled. */
export const States: Story = {
  render: (args) => (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <Combobox {...args} />
      <Combobox {...args} label="المريض المحوَّل" defaultValue={matching[0]?.id ?? null} />
      <Combobox {...args} label="المرافق" error="اختر مريضاً مسجلاً" />
      <Combobox {...args} label="صاحب الملف" disabled />
    </div>
  ),
};

/** Typed letters narrow the list; the typed part is bold. */
export const Suggestions: Story = {
  parameters: { matrix: false },
  play: async ({ canvasElement }) => {
    const input = within(canvasElement).getByRole('combobox', { name: 'المريض' });
    await userEvent.type(input, query);
    await waitFor(async () => {
      await expect(within(canvasElement.ownerDocument.body).getByRole('listbox')).toBeVisible();
    });
  },
};

/** No name matches. */
export const NoMatch: Story = {
  parameters: { matrix: false },
  play: async ({ canvasElement }) => {
    const input = within(canvasElement).getByRole('combobox', { name: 'المريض' });
    await userEvent.type(input, 'ظظظ');
    await waitFor(async () => {
      await expect(
        within(canvasElement.ownerDocument.body).getByText('لا يوجد مريض بهذا الاسم'),
      ).toBeVisible();
    });
  },
};

const states = storyStates((label) => (
  <Combobox label={label} items={ITEMS} emptyMessage="لا يوجد مريض بهذا الاسم" />
));
export const LongArabicLabel: Story = states['LongArabicLabel'] ?? {};
export const MixedDirection: Story = states['MixedDirection'] ?? {};
export const Zoom200: Story = states['Zoom200'] ?? {};
export const ReducedMotion: Story = states['ReducedMotion'] ?? {};
