// The components of A-03 (sheets approved by the owner 2026-11-27, A-03-01) as data for the
// design-system bundle: only JSON crosses from a Design canvas into the bundle's React
// (bundle-entry.tsx), so callbacks become local state and actions become their labels.
import { useState } from 'react';
import {
  Button,
  type ButtonVariant,
  EditableList as CodeEditableList,
  RecordHeader as CodeRecordHeader,
  RecordList as CodeRecordList,
  type EditableListItem,
  type IconName,
  type RecordHeaderProps,
  type RecordListItem,
  type RecordListProps,
} from '../../src/index.ts';
import { Menu, type MenuData } from './compound.tsx';

export type RecordListItemData = Omit<RecordListItem, 'action' | 'tools'> & {
  action?: { label: string; variant?: ButtonVariant };
  tools?: { icon: IconName; label: string; disabled?: boolean }[];
};

export type RecordListData = Omit<RecordListProps, 'items' | 'onOpen'> & {
  items: RecordListItemData[];
};

const nothing = () => undefined;

export function RecordList({ items, ...rest }: RecordListData) {
  return (
    <CodeRecordList
      {...rest}
      items={items.map(
        ({ action, tools, ...item }): RecordListItem => ({
          ...item,
          ...(action === undefined ? {} : { action: { ...action, onClick: nothing } }),
          ...(tools === undefined
            ? {}
            : { tools: tools.map((tool) => ({ ...tool, onClick: nothing })) }),
        }),
      )}
      // A drawing's rows lead nowhere: a press stays on the board.
      onOpen={(_id, event) => {
        event.preventDefault();
      }}
    />
  );
}

export type RecordHeaderData = Omit<RecordHeaderProps, 'actions' | 'meta' | 'readOnlyNote'> & {
  meta?: string;
  readOnlyNote?: string;
  /** Buttons by their label, and at most one menu (its rows as Menu's `items`). */
  actions?: (
    | { label: string; icon?: IconName; variant?: ButtonVariant }
    | ({ menu: true } & MenuData)
  )[];
};

export function RecordHeader({ actions, ...rest }: RecordHeaderData) {
  return (
    <CodeRecordHeader
      {...rest}
      {...(actions === undefined
        ? {}
        : {
            actions: actions.map((action) =>
              'menu' in action ? (
                <Menu key="menu" {...action} />
              ) : (
                <Button
                  key={action.label}
                  variant={action.variant ?? 'secondary'}
                  {...(action.icon === undefined ? {} : { startIcon: action.icon })}
                >
                  {action.label}
                </Button>
              ),
            ),
          })}
    />
  );
}

export interface EditableListData {
  label: string;
  items: EditableListItem[];
  max: number;
  readOnly?: boolean;
  addError?: string;
  foot?: string;
}

/** The list edited on the board itself: moves, renames, archives and additions stay local. */
export function EditableList({ items: start, ...rest }: EditableListData) {
  const [items, setItems] = useState(start);
  const change = (id: string, patch: Partial<EditableListItem>) => {
    setItems((list) => list.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  };
  return (
    <CodeEditableList
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
      onRename={(id, label) => {
        change(id, { label });
      }}
      onArchive={(id) => {
        change(id, { archived: true });
      }}
      onRestore={(id) => {
        change(id, { archived: false });
      }}
      onAdd={(label) => {
        setItems((list) => [...list, { id: `new-${String(list.length)}`, label }]);
      }}
    />
  );
}
