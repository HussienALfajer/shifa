// Tabs (slice 0.4-04), as the owner approved the sheet on 2026-11-20 ("Shifa Components
// (proposals)", page "Gate components · 0.4-04"): an underline list; the selected tab is green,
// heavier and underlined, so it is not told by colour alone. Behaviour from UI SDK's Tabs: arrows
// follow the reading direction (Left is next in Arabic), Home and End, automatic activation, a
// disabled tab is reachable and says so but is never selected.
import {
  Tabs as BaseTabs,
  TabsList as BaseTabsList,
  TabsPanel as BaseTabsPanel,
  TabsTab as BaseTabsTab,
} from '@ui-sdk/react/tabs';
import type { ReactNode } from 'react';
import { cn } from '../lib/cn.ts';

export interface TabsProps {
  /** The selected tab, when the parent owns it. */
  value?: string | undefined;
  /** The tab selected at first; the first enabled tab when left out. */
  defaultValue?: string | undefined;
  onValueChange?: ((value: string) => void) | undefined;
  className?: string | undefined;
  children: ReactNode;
}

export function Tabs({ value, defaultValue, onValueChange, className, children }: TabsProps) {
  return (
    <BaseTabs
      {...(value === undefined ? {} : { value })}
      {...(defaultValue === undefined ? {} : { defaultValue })}
      {...(onValueChange === undefined
        ? {}
        : {
            onValueChange: (next: string | null) => {
              if (next !== null) onValueChange(next);
            },
          })}
      className={cn('flex flex-col gap-4', className)}
    >
      {children}
    </BaseTabs>
  );
}

export interface TabListProps {
  /** What the set of tabs is about, for screen readers («ملف المريض»). */
  'aria-label': string;
  className?: string | undefined;
  children: ReactNode;
}

export function TabList({ className, children, ...aria }: TabListProps) {
  return (
    <BaseTabsList
      {...aria}
      className={cn('flex gap-1 overflow-x-auto border-b border-border-default', className)}
    >
      {children}
    </BaseTabsList>
  );
}

export interface TabProps {
  value: string;
  /** Reachable by the arrows and announced as disabled, but never selected. */
  disabled?: boolean | undefined;
  className?: string | undefined;
  children: ReactNode;
}

const TAB = cn(
  // The 2 px underline sits just above the list's 1 px line.
  'relative inline-flex min-h-(--shifa-size-control-md) shrink-0 items-center gap-2 px-4',
  'rounded-t-input border-b-2 border-transparent bg-transparent',
  'font-ui text-body font-medium leading-heading whitespace-nowrap text-text-muted in-data-[density=compact]:text-250',
  'cursor-pointer select-none transition-colors duration-(--shifa-motion-duration-fast) motion-reduce:transition-none',
  'hover:bg-selection-subtle hover:text-text-default',
  'data-selected:border-brand-primary data-selected:font-semibold data-selected:text-brand-primary',
  'data-disabled:cursor-not-allowed data-disabled:bg-transparent data-disabled:text-text-disabled',
  // Inside the tab: the list scrolls sideways on a narrow screen and would clip an outer ring.
  'focus-visible:shadow-focus focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-border-focus focus-visible:transition-none',
);

export function Tab({ value, disabled, className, children }: TabProps) {
  return (
    <BaseTabsTab
      value={value}
      {...(disabled === undefined ? {} : { disabled })}
      className={cn(TAB, className)}
    >
      {children}
    </BaseTabsTab>
  );
}

export interface TabPanelProps {
  value: string;
  className?: string | undefined;
  children: ReactNode;
}

export function TabPanel({ value, className, children }: TabPanelProps) {
  return (
    <BaseTabsPanel
      value={value}
      className={cn(
        'font-ui text-body leading-body text-text-default',
        'rounded-input focus-visible:shadow-focus focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus',
        className,
      )}
    >
      {children}
    </BaseTabsPanel>
  );
}
