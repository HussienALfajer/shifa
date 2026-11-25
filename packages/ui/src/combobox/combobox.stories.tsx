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
          'Search a long list as you type: a name matches when one of its words starts with the typed text; the typed part is bold. Say what happens when nothing matches (`emptyMessage`).\n\n**Accessibility.** The field is a `role="combobox"` named by its required `label`, with `aria-expanded` and `aria-autocomplete="list"`; the suggestions are a `listbox` of `option`s, and the highlighted one is the field’s `aria-activedescendant`. Focus stays in the field while typing: Down and Up Arrow move the highlight, Enter chooses it and closes the list, Escape closes the list. The clear button is a native `button` named by `clearLabel` («مسح»); the typed part of a name is bold, never told by colour alone.',
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

/** Open at rest with typed text (`defaultInputValue`, OD-119): the matches, the typed part bold. */
export const OpenAtRestTyped: Story = {
  parameters: { matrix: false },
  args: { defaultOpen: true, defaultInputValue: query },
};

/** Open at rest with text that matches nothing: the empty message. */
export const OpenAtRestNoMatch: Story = {
  parameters: { matrix: false },
  args: { defaultOpen: true, defaultInputValue: 'زز' },
};

const states = storyStates((label) => (
  <Combobox label={label} items={ITEMS} emptyMessage="لا يوجد مريض بهذا الاسم" />
));
export const LongArabicLabel: Story = states['LongArabicLabel'] ?? {};
export const MixedDirection: Story = states['MixedDirection'] ?? {};
export const Zoom200: Story = states['Zoom200'] ?? {};
export const ReducedMotion: Story = states['ReducedMotion'] ?? {};
