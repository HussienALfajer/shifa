// The composed components (Tabs, Dialog, Popover, Menu) as the design system sees them (slice
// 0.4-04). A canvas can hand the bundle only plain values, not elements of its own React, so each
// takes its content as data and builds the parts of packages/ui inside. The props are documented
// in index.d.ts; the parts themselves (Tab, MenuItem…) are not separate cards.
import { useState } from 'react';
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
  MenuGroup,
  MenuItem,
  MenuNote,
  type MenuPresentation,
  MenuRadioGroup,
  MenuRadioItem,
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
  AccordionItem: 'Accordion',
  AlertDialogTrigger: 'AlertDialog',
  AlertDialogContent: 'AlertDialog',
  AlertDialogCancel: 'AlertDialog',
  AlertDialogAction: 'AlertDialog',
  DrawerTrigger: 'Drawer',
  DrawerContent: 'Drawer',
  DrawerActions: 'Drawer',
  DrawerClose: 'Drawer',
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
  MenuGroup: 'Menu',
  MenuNote: 'Menu',
  MenuRadioGroup: 'Menu',
  MenuRadioItem: 'Menu',
  Radio: 'RadioGroup',
  FormField: 'Form',
  FormSubmit: 'Form',
  CardHeader: 'Card',
  CardBody: 'Card',
  CardFooter: 'Card',
  CardLink: 'Card',
  SkeletonText: 'Skeleton',
  SkeletonGroup: 'Skeleton',
  AvatarGroup: 'Avatar',
  ToolbarButton: 'Toolbar',
  ToolbarSeparator: 'Toolbar',
};

/** Cards of the design system that stand for a provider export, by the provider's name. */
export const PROVIDED: Record<string, string> = {
  Toast: 'ToastProvider',
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
  /** The trigger cannot be pressed. */
  triggerDisabled?: boolean;
  defaultOpen?: boolean;
}

export function Dialog(props: DialogData) {
  return (
    <CodeDialog {...(props.defaultOpen === undefined ? {} : { defaultOpen: props.defaultOpen })}>
      <DialogTrigger
        variant={props.triggerVariant}
        startIcon={props.triggerIcon}
        disabled={props.triggerDisabled}
      >
        {props.triggerLabel}
      </DialogTrigger>
      <DialogContent title={props.title} description={props.description}>
        <DialogActions>
          <DialogClose>{props.cancelLabel}</DialogClose>
          {/* As in the app once its action is done: the main action closes the dialog too. */}
          <DialogClose variant={props.confirmVariant ?? 'primary'}>
            {props.confirmLabel}
          </DialogClose>
        </DialogActions>
      </DialogContent>
    </CodeDialog>
  );
}

export interface PopoverData {
  triggerLabel: string;
  triggerIcon?: IconName;
  triggerVariant?: Variant;
  triggerDisabled?: boolean;
  title: string;
  /** A short text under the title. */
  text: string;
  defaultOpen?: boolean;
}

export function Popover(props: PopoverData) {
  return (
    <CodePopover {...(props.defaultOpen === undefined ? {} : { defaultOpen: props.defaultOpen })}>
      <PopoverTrigger
        startIcon={props.triggerIcon}
        variant={props.triggerVariant}
        disabled={props.triggerDisabled}
      >
        {props.triggerLabel}
      </PopoverTrigger>
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
  | { label: string; icon?: IconName; items: { value: string; label: string }[] }
  | {
      /** A radio group (A-01-08): the current row checked. */
      group: string;
      value: string | null;
      radios: {
        value: string;
        label: string;
        avatar?: string;
        icon?: IconName;
        description?: string;
        badge?: string;
        disabled?: boolean;
        busy?: boolean;
      }[];
    }
  | {
      /** Note rows under a label (A-01-08): information only. */
      group: string;
      notes: { label: string; icon?: IconName; description?: string }[];
    };

export interface MenuData {
  /** A label, or an icon with `aria-label` for an icon-only trigger. */
  triggerLabel?: string;
  triggerIcon?: IconName;
  'aria-label'?: string;
  /** `sheet`: the rows rising from the bottom, as on a phone, under `title`. */
  presentation?: MenuPresentation;
  title?: string;
  items: MenuEntry[];
  triggerVariant?: Variant;
  triggerSize?: 'sm' | 'md';
  triggerDisabled?: boolean;
  /** Opens the menu when it mounts, to show its rows. */
  defaultOpen?: boolean;
}

type RadioEntry = Extract<MenuEntry, { radios: unknown }>;

/** A radio group whose choice follows a press, as the app's switcher does. */
function Radios({ item }: { item: RadioEntry }) {
  const [value, setValue] = useState(item.value);
  return (
    <MenuRadioGroup label={item.group} value={value} onValueChange={setValue}>
      {item.radios.map(({ label, ...radio }) => (
        <MenuRadioItem key={radio.value} {...radio}>
          {label}
        </MenuRadioItem>
      ))}
    </MenuRadioGroup>
  );
}

function entry(item: MenuEntry, index: number) {
  if ('separator' in item) return <MenuSeparator key={`separator-${String(index)}`} />;
  if ('radios' in item) return <Radios key={item.group} item={item} />;
  if ('notes' in item) {
    return (
      <MenuGroup key={item.group} label={item.group}>
        {item.notes.map((note) => (
          <MenuNote key={note.label} icon={note.icon} description={note.description}>
            {note.label}
          </MenuNote>
        ))}
      </MenuGroup>
    );
  }
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

export function Menu({
  triggerLabel,
  triggerIcon,
  presentation,
  title,
  items,
  triggerVariant,
  triggerSize,
  triggerDisabled,
  defaultOpen,
  ...aria
}: MenuData) {
  const trigger = { variant: triggerVariant, size: triggerSize, disabled: triggerDisabled };
  return (
    <CodeMenu presentation={presentation} {...(defaultOpen === undefined ? {} : { defaultOpen })}>
      {triggerLabel === undefined ? (
        <MenuTrigger
          {...trigger}
          icon={triggerIcon ?? 'dots'}
          aria-label={aria['aria-label'] ?? 'إجراءات'}
        />
      ) : (
        <MenuTrigger {...trigger} icon={triggerIcon}>
          {triggerLabel}
        </MenuTrigger>
      )}
      <MenuContent title={title}>{items.map(entry)}</MenuContent>
    </CodeMenu>
  );
}
