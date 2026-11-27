// The overlay and navigation components of slice 0.4-06 as the design system sees them: a canvas
// hands the bundle plain values only, so each takes its content as data and builds the parts of
// packages/ui inside. The props are documented in index.d.ts.
import { useEffect, useRef } from 'react';
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
  triggerDisabled?: boolean;
  /**
   * What the action does when pressed, as the app's request would: `success` (the default)
   * finishes after a short wait and closes, `error` fails after it and shows `errorText`,
   * `pending` never finishes (the busy state).
   */
  actionResult?: 'success' | 'error' | 'pending';
  /** Presses the action once the dialog opens, to show its busy or failed state at rest. */
  runAction?: boolean;
  defaultOpen?: boolean;
}

/** How long the drawn request takes. */
const WAIT_MS = 1200;

function drawnRequest(result: AlertDialogData['actionResult']): () => Promise<void> {
  return () =>
    new Promise<void>((resolve, reject) => {
      if (result === 'pending') return;
      setTimeout(() => {
        if (result === 'error') reject(new Error('drawn failure'));
        else resolve();
      }, WAIT_MS);
    });
}

/** Presses the dialog's action once, from inside the open dialog (`runAction`). */
function PressAction({ label }: { label: string }) {
  const marker = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const dialog = marker.current?.closest('[role="alertdialog"], [role="dialog"]');
    const button = [...(dialog?.querySelectorAll('button') ?? [])].find(
      (b) => b.textContent.trim() === label,
    );
    const timer = setTimeout(() => button?.click(), 0);
    return () => {
      clearTimeout(timer);
    };
  }, [label]);
  return <span ref={marker} hidden />;
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
  triggerDisabled,
  actionResult,
  runAction,
  defaultOpen,
}: AlertDialogData) {
  const danger = (actionVariant ?? 'danger') === 'danger';
  return (
    <CodeAlertDialog {...(defaultOpen === undefined ? {} : { defaultOpen })}>
      <AlertDialogTrigger
        variant={danger ? 'danger' : 'secondary'}
        {...(triggerIcon === undefined ? {} : { startIcon: triggerIcon })}
        {...(triggerDisabled === undefined ? {} : { disabled: triggerDisabled })}
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
          onAction={drawnRequest(actionResult)}
          {...(actionVariant === undefined ? {} : { variant: actionVariant })}
          {...(errorText === undefined ? {} : { errorText })}
        >
          {actionLabel}
        </AlertDialogAction>
        {runAction === true && <PressAction label={actionLabel} />}
      </AlertDialogContent>
    </CodeAlertDialog>
  );
}

export interface DrawerData {
  triggerLabel: string;
  triggerIcon?: IconName;
  side?: 'start' | 'end' | 'bottom';
  /** `wide`: 550 px for a form with paired fields (A-03); 400 px by default. */
  size?: 'default' | 'wide';
  title: string;
  description?: string;
  fields?: { label: string; value?: string }[];
  cancelLabel?: string;
  saveLabel?: string;
  triggerDisabled?: boolean;
  defaultOpen?: boolean;
}

export function Drawer({
  triggerLabel,
  triggerIcon,
  side,
  size,
  title,
  description,
  fields = [],
  cancelLabel,
  saveLabel,
  triggerDisabled,
  defaultOpen,
}: DrawerData) {
  return (
    <CodeDrawer
      {...(side === undefined ? {} : { side })}
      {...(size === undefined ? {} : { size })}
      {...(defaultOpen === undefined ? {} : { defaultOpen })}
    >
      <DrawerTrigger
        {...(triggerIcon === undefined ? {} : { startIcon: triggerIcon })}
        {...(triggerDisabled === undefined ? {} : { disabled: triggerDisabled })}
      >
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
            {/* As in the app once the change is saved: saving closes the drawer. */}
            {saveLabel !== undefined && <DrawerClose variant="primary">{saveLabel}</DrawerClose>}
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
  /** The tooltip never opens (its trigger stays pressable). */
  disabled?: boolean;
  defaultOpen?: boolean;
}

export function Tooltip({
  content,
  triggerLabel,
  triggerIcon,
  side,
  disabled,
  defaultOpen,
}: TooltipData) {
  const common = {
    ...(side === undefined ? {} : { side }),
    ...(disabled === undefined ? {} : { disabled }),
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
