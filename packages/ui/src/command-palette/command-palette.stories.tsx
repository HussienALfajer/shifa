// Command palette stories, as on the approved sheet (owner, 2026-11-22). The trigger renders in
// the eight combinations of direction × theme × density; the open palette is a play story (a
// modal covers the page, so eight cannot sit side by side).
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { storyStates } from '../../.storybook/story-states.tsx';
import { people } from '../../test/fixtures.ts';
import { Button } from '../button/button.tsx';
import { CommandPalette, type CommandPaletteGroup } from './command-palette.tsx';

const meta = {
  title: 'Components/CommandPalette',
  component: CommandPalette,
  parameters: {
    docs: {
      // Stories open a modal on load: inline on the docs page they would cover it (and make it
      // inert), so each docs story renders in its own frame.
      story: { inline: false, iframeHeight: 640 },
      description: {
        component:
          'One search over patients and actions, in a modal panel near the top. Matching folds case, diacritics, tatweel and alef forms (pass `normalise` for the full name rules); the matched part is marked in gold.\n\n**Accessibility.** A modal `role="dialog"` named by its `title`, which is shown only to screen readers; inside it the search field is a `role="combobox"` named by `inputLabel`, over a `listbox` of `option`s in titled groups, the matched part in a `<mark>`. Focus starts and stays in the field: Up and Down Arrow move the active option (the field’s `aria-activedescendant`), Enter runs it and closes, Escape clears the text, then closes, and focus returns to the trigger. After typing pauses, the number of results is announced (`resultsLabel`, «3 نتيجة» or «لا نتائج»); the line of key hints under the list is hidden from screen readers.',
      },
    },
  },
  args: {
    title: 'بحث وأوامر',
    inputLabel: 'ابحث عن مريض أو إجراء',
    groups: [],
    onAction: () => undefined,
    emptyText: () => '',
  },
} satisfies Meta<typeof CommandPalette>;

export default meta;
type Story = StoryObj<typeof meta>;

const PATIENTS = people(4, { seed: 11 });

const GROUPS: CommandPaletteGroup[] = [
  {
    label: 'المرضى',
    items: [
      { value: 'p-ahmad', label: 'أحمد خليل', description: 'ملف 1187', icon: 'user' },
      ...PATIENTS.map((p) => ({
        value: p.id,
        label: p.name,
        description: `ملف ${p.id}`,
        icon: 'user' as const,
      })),
    ],
  },
  {
    label: 'إجراءات',
    items: [
      { value: 'new-appointment', label: 'موعد جديد', icon: 'calendar-plus' },
      { value: 'new-patient', label: 'تسجيل مريض جديد', icon: 'plus' },
    ],
  },
];

function Palette({ trigger = 'بحث' }: { trigger?: string }) {
  return (
    <CommandPalette
      triggerLabel={trigger}
      title="بحث وأوامر"
      inputLabel="ابحث عن مريض أو إجراء"
      groups={GROUPS}
      onAction={() => undefined}
      emptyText={(query) => `لا نتائج لـ «${query}»`}
      emptyAction={<Button size="sm">تسجيل مريض جديد</Button>}
    />
  );
}

async function openWith(canvasElement: HTMLElement, text: string) {
  await userEvent.click(within(canvasElement).getByRole('button', { name: 'بحث' }));
  const body = within(canvasElement.ownerDocument.body);
  const input = await body.findByRole('combobox');
  await waitFor(async () => {
    await expect(input).toHaveFocus();
  });
  if (text !== '') await userEvent.type(input, text);
  return body;
}

/** The trigger at rest. */
export const Default: Story = { render: () => <Palette /> };

/** Shown from the start, for the screenshot. */
export const Shown: Story = {
  parameters: { matrix: false },
  render: () => (
    <CommandPalette
      defaultOpen
      title="بحث وأوامر"
      inputLabel="ابحث عن مريض أو إجراء"
      groups={GROUPS}
      onAction={() => undefined}
      emptyText={(query) => `لا نتائج لـ «${query}»`}
    />
  ),
};

/** Open, every option. */
export const Open: Story = {
  parameters: { matrix: false },
  render: () => <Palette />,
  play: async ({ canvasElement }) => {
    await openWith(canvasElement, '');
  },
};

/** «احمد» finds «أحمد خليل», the match marked. */
export const Matching: Story = {
  parameters: { matrix: false },
  render: () => <Palette />,
  play: async ({ canvasElement }) => {
    const body = await openWith(canvasElement, 'احمد');
    await waitFor(async () => {
      await expect(body.getAllByRole('option')).toHaveLength(1);
    });
  },
};

/** No match: the empty state with an action. */
export const Empty: Story = {
  parameters: { matrix: false },
  render: () => <Palette />,
  play: async ({ canvasElement }) => {
    const body = await openWith(canvasElement, 'زينب');
    await expect(await body.findByText('لا نتائج لـ «زينب»')).toBeVisible();
  },
};

const states = storyStates((label) => <Palette trigger={label} />);
export const LongArabicLabel: Story = states['LongArabicLabel'] ?? {};
export const MixedDirection: Story = states['MixedDirection'] ?? {};
export const Zoom200: Story = states['Zoom200'] ?? {};
export const ReducedMotion: Story = states['ReducedMotion'] ?? {};
