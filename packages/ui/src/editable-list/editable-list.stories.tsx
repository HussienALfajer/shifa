// EditableList stories, as on the approved sheet (owner, 2026-11-27, A03SheetEditableList): the
// choices with one renamed in place and one archived; a duplicate refused; empty (the first
// choice); full (4 here, 250 in the product); read-only (a support session); and a rename by
// keyboard. Every story renders in the eight combinations of direction × theme × density and is
// checked by axe.
import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { expect, userEvent, within } from 'storybook/test';
import { storyStates } from '../../.storybook/story-states.tsx';
import { EditableList, type EditableListItem } from './editable-list.tsx';

const CHOICES: EditableListItem[] = [
  { id: 'a', label: 'طبيب آخر', use: 'في 41 ملفًا' },
  { id: 'b', label: 'صيدلية', use: 'في 12 ملفًا' },
  { id: 'c', label: 'الأهل والمعارف', use: 'في 96 ملفًا' },
  { id: 'd', label: 'وسائل التواصل', use: 'في 30 ملفًا' },
  { id: 'e', label: 'جريدة', use: 'في ملفين', archived: true },
];

/** The list with its edits kept in the story, as a screen keeps them until the server answers. */
function Choices({
  start = CHOICES,
  label = 'خيارات «جهة الإحالة»',
  ...rest
}: { start?: EditableListItem[]; label?: string } & Partial<
  Pick<Parameters<typeof EditableList>[0], 'max' | 'readOnly' | 'addError'>
>) {
  const [items, setItems] = useState(start);
  const set = (id: string, patch: Partial<EditableListItem>) => {
    setItems((list) => list.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  };
  return (
    <EditableList
      label={label}
      max={250}
      {...rest}
      items={items}
      onMove={(id, direction) => {
        setItems((list) => {
          const active = list.filter((i) => !i.archived);
          const at = active.findIndex((i) => i.id === id);
          const to = at + (direction === 'up' ? -1 : 1);
          const [a, b] = [active[at], active[to]];
          if (a === undefined || b === undefined) return list;
          active[at] = b;
          active[to] = a;
          return [...active, ...list.filter((i) => i.archived)];
        });
      }}
      onRename={(id, next) => {
        set(id, { label: next });
      }}
      onArchive={(id) => {
        set(id, { archived: true });
      }}
      onRestore={(id) => {
        set(id, { archived: false });
      }}
      onAdd={(next) => {
        setItems((list) => [...list, { id: next, label: next }]);
      }}
    />
  );
}

const meta = {
  title: 'Components/EditableList',
  component: EditableList,
  args: { label: 'خيارات «جهة الإحالة»', items: CHOICES, max: 250 },
  parameters: {
    docs: {
      description: {
        component:
          'A short list edited in place, such as a choice field’s choices: numbered rows with how many records hold each (`use`), up and down, rename in place, archive (never delete) and restore, the add line, and the count against `max`. The caller keeps the items and answers `onMove`, `onRename`, `onArchive`, `onRestore` and `onAdd`; archiving needs no question (show «أُرشف …» with «تراجع» in a Toast). A name that folds to one already there is refused before it is sent. `readOnly` shows no tools and no add line; `words` replaces any text.\n\n**Accessibility.** A `role="group"` named by `label`; the rows are a list of `listitem`s. Every tool is a `button` named by its row («نقل «صيدلية» للأعلى», «إعادة تسمية «صيدلية»»); up on the first row and down on the last stay focusable with `aria-disabled`, so focus stays on the row it moved. Rename opens a labelled field («اسم الخيار») with focus in it: Enter saves, Escape cancels and returns to the rename button. Enter in the add field («خيار جديد») adds. Errors are the field’s own (`aria-invalid` and its message); the count turns to the warning colour when full and the add button is disabled with the reason under the field.',
      },
    },
  },
} satisfies Meta<typeof EditableList>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Choices, one archived. */
export const Default: Story = { render: () => <Choices /> };

/** Empty: the first choice, with the list's own error. */
export const Empty: Story = {
  render: () => (
    <Choices
      start={[]}
      label="خيارات «شركة التأمين»"
      addError="حقل الاختيار يحتاج خيارين على الأقل."
    />
  ),
};

/** Full (4 here, 250 in the product), and read-only in a support session. */
export const FullAndReadOnly: Story = {
  render: () => (
    <div className="flex flex-col gap-6">
      <Choices start={CHOICES.slice(0, 4)} max={4} />
      <Choices start={CHOICES.slice(0, 4)} readOnly />
    </div>
  ),
};

/** Rename by keyboard, then a duplicate refused on the add line. */
export const RenameAndDuplicate: Story = {
  parameters: { matrix: false },
  render: () => <Choices />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'إعادة تسمية «صيدلية»' }));
    const field = canvas.getByRole('textbox', { name: 'اسم الخيار' });
    await expect(field).toHaveFocus();
    await userEvent.keyboard('{Escape}');
    const add = canvas.getByRole('textbox', { name: 'خيار جديد' });
    await userEvent.type(add, 'صيدليه{Enter}');
    await expect(add).toHaveAttribute('aria-invalid', 'true');
  },
};

const states = storyStates((label) => (
  <EditableList label={label} max={250} items={[{ id: 'a', label, use: label }]} readOnly />
));
export const LongArabicLabel: Story = states['LongArabicLabel'] ?? {};
export const MixedDirection: Story = states['MixedDirection'] ?? {};
export const Zoom200: Story = states['Zoom200'] ?? {};
export const ReducedMotion: Story = states['ReducedMotion'] ?? {};
