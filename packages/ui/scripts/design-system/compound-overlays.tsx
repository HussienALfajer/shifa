// The overlay and navigation components of slice 0.4-06 as the design system sees them: a canvas
// hands the bundle plain values only, so each takes its content as data and builds the parts of
// packages/ui inside. The props are documented in index.d.ts.
import { AccordionItem, Accordion as CodeAccordion } from '../../src/accordion/accordion.tsx';
import { Button } from '../../src/button/button.tsx';
import { IconButton } from '../../src/icon-button/icon-button.tsx';
import type { IconName } from '../../src/icons/icon.tsx';
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
