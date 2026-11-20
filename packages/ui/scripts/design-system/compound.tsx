// The composed components (Tabs, Dialog, Popover, Menu) as the design system sees them (slice
// 0.4-04). A canvas can hand the bundle only plain values, not elements of its own React, so each
// takes its content as data and builds the parts of packages/ui inside. The props are documented
// in index.d.ts; the parts themselves (Tab, MenuItem…) are not separate cards.
import { Button } from '../../src/button/button.tsx';
import {
  Dialog as CodeDialog,
  DialogActions,
  DialogClose,
  DialogContent,
  DialogTrigger,
} from '../../src/dialog/dialog.tsx';
import type { IconName } from '../../src/icons/icon.tsx';
import {
  Menu as CodeMenu,
  MenuContent,
  MenuItem,
  MenuSeparator,
  MenuTrigger,
  Submenu,
} from '../../src/menu/menu.tsx';
import {
  Popover as CodePopover,
  PopoverContent,
  PopoverTrigger,
} from '../../src/popover/popover.tsx';
import { Tabs as CodeTabs, Tab, TabList, TabPanel } from '../../src/tabs/tabs.tsx';

/** Exports of packages/ui that are parts of a composed component, by the component they belong to. */
export const PARTS: Record<string, string> = {
  Tab: 'Tabs',
  TabList: 'Tabs',
  TabPanel: 'Tabs',
  DialogTrigger: 'Dialog',
  DialogContent: 'Dialog',
  DialogActions: 'Dialog',
  DialogClose: 'Dialog',
  PopoverTrigger: 'Popover',
  PopoverContent: 'Popover',
  MenuTrigger: 'Menu',
  MenuContent: 'Menu',
  MenuItem: 'Menu',
  MenuSeparator: 'Menu',
  Submenu: 'Menu',
  Radio: 'RadioGroup',
  FormField: 'Form',
  FormSubmit: 'Form',
};

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

export interface TabsData {
  'aria-label': string;
  items: { value: string; label: string; panel?: string; disabled?: boolean }[];
  defaultValue?: string;
}

export function Tabs({ items, defaultValue, ...aria }: TabsData) {
  return (
    <CodeTabs {...(defaultValue === undefined ? {} : { defaultValue })}>
      <TabList aria-label={aria['aria-label']}>
        {items.map((item) => (
          <Tab key={item.value} value={item.value} disabled={item.disabled}>
            {item.label}
          </Tab>
        ))}
      </TabList>
      {items.map((item) => (
        <TabPanel key={item.value} value={item.value}>
          {item.panel ?? ''}
        </TabPanel>
      ))}
    </CodeTabs>
  );
}

export interface DialogData {
  triggerLabel: string;
  triggerVariant?: Variant;
  triggerIcon?: IconName;
  title: string;
  description?: string;
  /** The safe action that only closes («رجوع»), focused first. */
  cancelLabel: string;
  /** The main action, last in the row. */
  confirmLabel: string;
  confirmVariant?: Variant;
  defaultOpen?: boolean;
}

export function Dialog(props: DialogData) {
  return (
    <CodeDialog {...(props.defaultOpen === undefined ? {} : { defaultOpen: props.defaultOpen })}>
      <DialogTrigger variant={props.triggerVariant} startIcon={props.triggerIcon}>
        {props.triggerLabel}
      </DialogTrigger>
      <DialogContent title={props.title} description={props.description}>
        <DialogActions>
          <DialogClose>{props.cancelLabel}</DialogClose>
          <Button variant={props.confirmVariant ?? 'primary'}>{props.confirmLabel}</Button>
        </DialogActions>
      </DialogContent>
    </CodeDialog>
  );
}

export interface PopoverData {
  triggerLabel: string;
  triggerIcon?: IconName;
  title: string;
  /** A short text under the title. */
  text: string;
  defaultOpen?: boolean;
}

export function Popover(props: PopoverData) {
  return (
    <CodePopover {...(props.defaultOpen === undefined ? {} : { defaultOpen: props.defaultOpen })}>
      <PopoverTrigger startIcon={props.triggerIcon}>{props.triggerLabel}</PopoverTrigger>
      <PopoverContent title={props.title}>
        <p className="m-0 text-body leading-body text-text-muted">{props.text}</p>
      </PopoverContent>
    </CodePopover>
  );
}

type MenuEntry =
  | {
      value: string;
      label: string;
      icon?: IconName;
      danger?: boolean;
      disabled?: boolean;
      hint?: string;
    }
  | { separator: true }
  | { label: string; icon?: IconName; items: { value: string; label: string }[] };

export interface MenuData {
  /** A label, or an icon with `aria-label` for an icon-only trigger. */
  triggerLabel?: string;
  triggerIcon?: IconName;
  'aria-label'?: string;
  items: MenuEntry[];
}

function entry(item: MenuEntry, index: number) {
  if ('separator' in item) return <MenuSeparator key={`separator-${String(index)}`} />;
  if ('items' in item) {
    return (
      <Submenu key={item.label} label={item.label} icon={item.icon}>
        {item.items.map((sub) => (
          <MenuItem key={sub.value} value={sub.value}>
            {sub.label}
          </MenuItem>
        ))}
      </Submenu>
    );
  }
  return (
    <MenuItem
      key={item.value}
      value={item.value}
      icon={item.icon}
      danger={item.danger}
      disabled={item.disabled}
      hint={item.hint}
    >
      {item.label}
    </MenuItem>
  );
}

export function Menu({ triggerLabel, triggerIcon, items, ...aria }: MenuData) {
  return (
    <CodeMenu>
      {triggerLabel === undefined ? (
        <MenuTrigger icon={triggerIcon ?? 'dots'} aria-label={aria['aria-label'] ?? 'إجراءات'} />
      ) : (
        <MenuTrigger icon={triggerIcon}>{triggerLabel}</MenuTrigger>
      )}
      <MenuContent>{items.map(entry)}</MenuContent>
    </CodeMenu>
  );
}
