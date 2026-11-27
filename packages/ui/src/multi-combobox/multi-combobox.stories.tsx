// MultiCombobox stories, as on the approved sheet (owner, 2026-11-27, A02SheetMultiCombobox): empty,
// two chosen, error and disabled in the eight combinations; the open list with a chosen one and
// the typed part in bold, and no match, open at rest. Names come from the synthetic generator.
import type { Meta, StoryObj } from '@storybook/react-vite';
import { storyStates } from '../../.storybook/story-states.tsx';
import { patientsSharing } from '../../test/fixtures.ts';
import type { ComboboxItem } from '../combobox/combobox.tsx';
import { MultiCombobox } from './multi-combobox.tsx';

const { query, matching, others } = patientsSharing();
const ITEMS: ComboboxItem[] = [...matching, ...others].map((p) => ({
  value: p.id,
  label: `عيادة ${p.name}`,
}));
const CHOSEN = [ITEMS[0]?.value ?? '', ITEMS[4]?.value ?? ''];

const meta = {
  title: 'Components/MultiCombobox',
  component: MultiCombobox,
  args: {
    label: 'العيادات المختارة',
    items: ITEMS,
    emptyMessage: 'لا عيادة بهذا الاسم',
    placeholder: 'ابحث عن عيادة',
  },
  parameters: {
    docs: {
      description: {
        component:
          'Choose several items from a long list by typing: clinics for a flag or an announcement. The chosen ones are chips inside the field, each with its remove button; a name matches when one of its words starts with the typed text (Arabic folded as in Combobox), the typed part in bold; the list stays open after each pick and ticks the chosen. Say what happens when nothing matches (`emptyMessage`).\n\n**Accessibility.** The field is a `role="combobox"` named by its required `label`; the suggestions are a `listbox` with `aria-multiselectable="true"`, each `option` `aria-selected` when chosen (the tick is decoration). Focus stays in the field: Down and Up Arrow move the highlight, Enter toggles it and keeps the list open, Escape closes it, Backspace in the empty field removes the last chip. Each chip’s remove button is named «إزالة …» («Remove …» in English, or `removeLabel`). The number of results is announced once typing pauses; an error is announced with the field.',
      },
    },
  },
} satisfies Meta<typeof MultiCombobox>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Empty with its hint, two chosen, an error and disabled. */
export const States: Story = {
  render: (args) => (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <MultiCombobox {...args} hint="ابحث بالاسم واختر عيادة أو أكثر." />
      <MultiCombobox {...args} defaultValue={CHOSEN} hint="مختارة: 2." />
      <MultiCombobox {...args} error="اختر عيادة واحدة على الأقل." />
      <MultiCombobox {...args} defaultValue={CHOSEN} disabled />
    </div>
  ),
};

/** Open with typed text and one chosen: the matches, a tick on the chosen, the typed part bold. */
export const OpenTyped: Story = {
  parameters: { matrix: false },
  args: { defaultOpen: true, defaultInputValue: query, defaultValue: [matching[0]?.id ?? ''] },
};

/** Open with text that matches nothing: the empty message. */
export const OpenNoMatch: Story = {
  parameters: { matrix: false },
  args: { defaultOpen: true, defaultInputValue: 'زز' },
};

const states = storyStates((label) => (
  <MultiCombobox
    label={label}
    items={[...ITEMS, { value: 'long', label }]}
    defaultValue={['long']}
    emptyMessage="لا عيادة بهذا الاسم"
  />
));
export const LongArabicLabel: Story = states['LongArabicLabel'] ?? {};
export const MixedDirection: Story = states['MixedDirection'] ?? {};
export const Zoom200: Story = states['Zoom200'] ?? {};
export const ReducedMotion: Story = states['ReducedMotion'] ?? {};
