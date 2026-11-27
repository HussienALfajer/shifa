// EditableList review fixes (A-03-12 reviewer): archiving keeps the keyboard's focus on the row's
// «استعادة»; when the list is full, «استعادة» is refused before anything is sent.
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { renderDir } from '../../test/support/index.ts';
import { EditableList, type EditableListItem } from './editable-list.tsx';

const DIRS = ['rtl', 'ltr'] as const;

function List({
  start,
  max,
  onRestore,
}: {
  start: EditableListItem[];
  max: number;
  onRestore?: (id: string) => void;
}) {
  const [items, setItems] = useState(start);
  return (
    <EditableList
      label="خيارات"
      items={items}
      max={max}
      onArchive={(id) => {
        setItems((list) => list.map((i) => (i.id === id ? { ...i, archived: true } : i)));
      }}
      onRestore={(id) => {
        onRestore?.(id);
        setItems((list) => list.map((i) => (i.id === id ? { ...i, archived: false } : i)));
      }}
    />
  );
}

describe.each(DIRS)('EditableList review fixes in %s', (dir) => {
  const archive = dir === 'rtl' ? 'أرشفة «صيدلية»' : 'Archive “صيدلية”';
  const restore = dir === 'rtl' ? 'استعادة «صيدلية»' : 'Restore “صيدلية”';

  it('archiving moves the focus to the row’s restore button', async () => {
    const screen = await renderDir(
      <List
        max={250}
        start={[
          { id: 'a', label: 'طبيب آخر' },
          { id: 'b', label: 'صيدلية' },
        ]}
      />,
      { dir },
    );
    (screen.getByRole('button', { name: archive }).element() as HTMLElement).focus();
    await userEvent.keyboard('{Enter}');
    expect(document.activeElement?.getAttribute('aria-label')).toBe(restore);
    await screen.unmount();
  });

  it('full: restore is marked disabled and sends nothing', async () => {
    const onRestore = vi.fn();
    const screen = await renderDir(
      <List
        max={1}
        onRestore={onRestore}
        start={[
          { id: 'a', label: 'طبيب آخر' },
          { id: 'b', label: 'صيدلية', archived: true },
        ]}
      />,
      { dir },
    );
    const button = screen.getByRole('button', { name: restore });
    expect(button.element().getAttribute('aria-disabled')).toBe('true');
    await button.click({ force: true });
    expect(onRestore).not.toHaveBeenCalled();
    await screen.unmount();
  });
});
