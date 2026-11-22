// The overlay and navigation components of slice 0.4-06 as the design system sees them: a canvas
// hands the bundle plain values only, so each takes its content as data and builds the parts of
// packages/ui inside. The props are documented in index.d.ts.
import { AccordionItem, Accordion as CodeAccordion } from '../../src/accordion/accordion.tsx';
import {
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogTrigger,
  AlertDialog as CodeAlertDialog,
} from '../../src/alert-dialog/alert-dialog.tsx';
import { Button } from '../../src/button/button.tsx';
import {
  Drawer as CodeDrawer,
  DrawerActions,
  DrawerClose,
  DrawerContent,
  DrawerTrigger,
} from '../../src/drawer/drawer.tsx';
import { IconButton } from '../../src/icon-button/icon-button.tsx';
import type { IconName } from '../../src/icons/icon.tsx';
import { Input } from '../../src/input/input.tsx';
import { Tooltip as CodeTooltip } from '../../src/tooltip/tooltip.tsx';

export interface AccordionData {
  items: { value: string; title: string; content: string; badge?: string; disabled?: boolean }[];
  defaultValue?: string[];
  multiple?: boolean;
}

export function Accordion({ items, defaultValue, multiple }: AccordionData) {
  return (
    <CodeAccordion
      {...(defaultValue === undefined ? {} : { defaultValue })}
      {...(multiple === undefined ? {} : { multiple })}
    >
      {items.map((item) => (
        <AccordionItem
          key={item.value}
          value={item.value}
          title={item.title}
          {...(item.badge === undefined ? {} : { badge: item.badge })}
          {...(item.disabled === undefined ? {} : { disabled: item.disabled })}
        >
          {item.content}
        </AccordionItem>
      ))}
    </CodeAccordion>
  );
}

export interface AlertDialogData {
  triggerLabel: string;
  triggerIcon?: IconName;
  title: string;
  description?: string;
  tone?: 'danger' | 'info';
  cancelLabel: string;
  actionLabel: string;
  actionVariant?: 'danger' | 'primary';
  errorText?: string;
  defaultOpen?: boolean;
}

export function AlertDialog({
  triggerLabel,
  triggerIcon,
  title,
  description,
  tone,
  cancelLabel,
  actionLabel,
  actionVariant,
  errorText,
  defaultOpen,
}: AlertDialogData) {
  const danger = (actionVariant ?? 'danger') === 'danger';
  return (
    <CodeAlertDialog {...(defaultOpen === undefined ? {} : { defaultOpen })}>
      <AlertDialogTrigger
        variant={danger ? 'danger' : 'secondary'}
        {...(triggerIcon === undefined ? {} : { startIcon: triggerIcon })}
      >
        {triggerLabel}
      </AlertDialogTrigger>
      <AlertDialogContent
        title={title}
        {...(description === undefined ? {} : { description })}
        {...(tone === undefined ? {} : { tone })}
      >
        <AlertDialogCancel>{cancelLabel}</AlertDialogCancel>
        <AlertDialogAction
          {...(actionVariant === undefined ? {} : { variant: actionVariant })}
          {...(errorText === undefined ? {} : { errorText })}
        >
          {actionLabel}
        </AlertDialogAction>
      </AlertDialogContent>
    </CodeAlertDialog>
  );
}

export interface DrawerData {
  triggerLabel: string;
  triggerIcon?: IconName;
  side?: 'start' | 'end' | 'bottom';
  title: string;
  description?: string;
  fields?: { label: string; value?: string }[];
  cancelLabel?: string;
  saveLabel?: string;
  defaultOpen?: boolean;
}

export function Drawer({
  triggerLabel,
  triggerIcon,
  side,
  title,
  description,
  fields = [],
  cancelLabel,
  saveLabel,
  defaultOpen,
}: DrawerData) {
  return (
    <CodeDrawer
      {...(side === undefined ? {} : { side })}
      {...(defaultOpen === undefined ? {} : { defaultOpen })}
    >
      <DrawerTrigger {...(triggerIcon === undefined ? {} : { startIcon: triggerIcon })}>
        {triggerLabel}
      </DrawerTrigger>
      <DrawerContent title={title} {...(description === undefined ? {} : { description })}>
        {fields.map((field) => (
          <Input
            key={field.label}
            label={field.label}
            {...(field.value === undefined ? {} : { defaultValue: field.value })}
          />
        ))}
        {(cancelLabel !== undefined || saveLabel !== undefined) && (
          <DrawerActions>
            {cancelLabel !== undefined && <DrawerClose>{cancelLabel}</DrawerClose>}
            {saveLabel !== undefined && <Button variant="primary">{saveLabel}</Button>}
          </DrawerActions>
        )}
      </DrawerContent>
    </CodeDrawer>
  );
}

export interface TooltipData {
  content: string;
  /** A text trigger; the tooltip describes it. */
  triggerLabel?: string;
  /** An icon trigger with no text: an icon button named by `content`. */
  triggerIcon?: IconName;
  side?: 'top' | 'bottom';
  defaultOpen?: boolean;
}

export function Tooltip({ content, triggerLabel, triggerIcon, side, defaultOpen }: TooltipData) {
  const common = {
    ...(side === undefined ? {} : { side }),
    ...(defaultOpen === undefined ? {} : { defaultOpen }),
  };
  if (triggerLabel === undefined) {
    return (
      <CodeTooltip content={content} type="label" {...common}>
        <IconButton icon={triggerIcon ?? 'info'} label={content} />
      </CodeTooltip>
    );
  }
  return (
    <CodeTooltip content={content} {...common}>
      <Button {...(triggerIcon === undefined ? {} : { startIcon: triggerIcon })}>
        {triggerLabel}
      </Button>
    </CodeTooltip>
  );
}
