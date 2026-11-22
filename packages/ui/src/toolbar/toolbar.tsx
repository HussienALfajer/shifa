// Toolbar (slice 0.4-07), as the owner approved the sheet on 2026-11-22 ("Shifa Components
// (proposals)", page "Data display and table · 0.4-07"): a bordered strip of light buttons with
// one Tab stop. Roving focus comes from UI SDK's Toolbar: the arrows follow the reading direction
// (Left is next in Arabic), Home and End reach the ends, no wrapping, a disabled button is skipped.
// Groups are split by vertical separators. When the strip is too narrow, the last buttons move
// into a «المزيد» menu (our Menu, 0.4-04), measured with a ResizeObserver.
import { MenuTrigger as BaseMenuTrigger } from '@ui-sdk/react/menu';
import {
  Toolbar as BaseToolbar,
  ToolbarButton as BaseToolbarButton,
  ToolbarSeparator as BaseToolbarSeparator,
} from '@ui-sdk/react/toolbar';
import {
  createContext,
  type MouseEvent,
  type ReactNode,
  useCallback,
  useContext,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { buttonClasses } from '../button/button.tsx';
import { Icon, type IconName } from '../icons/icon.tsx';
import { cn } from '../lib/cn.ts';
import { Menu, MenuContent, MenuItem } from '../menu/menu.tsx';

interface Entry {
  label: string;
  icon: IconName | undefined;
  disabled: boolean;
  onClick: (() => void) | undefined;
}

interface ToolbarContextValue {
  register: (id: string, entry: Entry) => () => void;
  hidden: ReadonlySet<string>;
}

const ToolbarContext = createContext<ToolbarContextValue | null>(null);

const ITEM = cn(
  buttonClasses({ variant: 'ghost' }),
  'text-text-default',
  'aria-pressed:bg-selection-default aria-pressed:border-border-strong',
);

export interface ToolbarProps {
  /** What the tools act on: «أدوات قائمة المرضى». */
  'aria-label': string;
  /** The name of the menu that takes the buttons that do not fit. */
  moreLabel?: string;
  children: ReactNode;
  className?: string;
}

export function Toolbar({
  'aria-label': label,
  moreLabel = 'المزيد',
  children,
  className,
}: ToolbarProps) {
  const root = useRef<HTMLDivElement | null>(null);
  const entries = useRef(new Map<string, Entry>());
  const widths = useRef(new Map<string, number>());
  const [hidden, setHidden] = useState<ReadonlySet<string>>(new Set());
  const [version, setVersion] = useState(0);

  const register = useCallback((id: string, entry: Entry) => {
    entries.current.set(id, entry);
    setVersion((v) => v + 1);
    return () => {
      entries.current.delete(id);
      widths.current.delete(id);
      setVersion((v) => v + 1);
    };
  }, []);

  // Fit the buttons into the strip: measure each shown button once, then hide from the end until
  // the rest and the «المزيد» button fit.
  const fit = useCallback(() => {
    const el = root.current;
    if (el === null) return;
    for (const node of el.querySelectorAll<HTMLElement>('[data-toolbar-id]')) {
      const id = node.dataset['toolbarId'];
      if (id !== undefined) widths.current.set(id, node.getBoundingClientRect().width);
    }
    const style = getComputedStyle(el);
    const gap = Number.parseFloat(style.columnGap) || 0;
    const inner =
      el.clientWidth -
      Number.parseFloat(style.paddingInlineStart) -
      Number.parseFloat(style.paddingInlineEnd);
    const ids = [...el.querySelectorAll<HTMLElement>('[data-toolbar-slot]')]
      .map((n) => n.dataset['toolbarSlot'])
      .filter((id): id is string => id !== undefined);
    // A separator takes its width and its inline margins; n items are split by n - 1 gaps.
    const separators = [...el.querySelectorAll<HTMLElement>('[data-slot="toolbar-separator"]')];
    const fixed = separators.reduce((sum, n) => {
      const m = getComputedStyle(n);
      return (
        sum +
        n.getBoundingClientRect().width +
        Number.parseFloat(m.marginInlineStart) +
        Number.parseFloat(m.marginInlineEnd)
      );
    }, 0);
    const widthOf = (id: string) => widths.current.get(id) ?? 0;
    const span = (items: number, sum: number) => sum + gap * Math.max(0, items - 1);
    const all = span(
      ids.length + separators.length,
      ids.reduce((sum, id) => sum + widthOf(id), fixed),
    );
    if (all <= inner) {
      setHidden((prev) => (prev.size === 0 ? prev : new Set()));
      return;
    }
    const more = widths.current.get('__more') ?? 44;
    let shown = 0;
    let sum = fixed + more;
    const next = new Set<string>();
    let full = false;
    for (const id of ids) {
      const fits = span(shown + 1 + separators.length + 1, sum + widthOf(id)) <= inner;
      if (!full && fits) {
        sum += widthOf(id);
        shown += 1;
      } else {
        full = true;
        next.add(id);
      }
    }
    setHidden((prev) =>
      prev.size === next.size && [...next].every((id) => prev.has(id)) ? prev : next,
    );
  }, []);

  useLayoutEffect(() => {
    const el = root.current;
    if (el === null) return undefined;
    fit();
    const observer = new ResizeObserver(() => {
      fit();
    });
    observer.observe(el);
    // The strip fills its parent; watching the parent too catches a row that grows again.
    if (el.parentElement !== null) observer.observe(el.parentElement);
    return () => {
      observer.disconnect();
    };
  }, [fit, version]);

  const context = useMemo(() => ({ register, hidden }), [register, hidden]);
  const overflow = [...hidden]
    .map((id) => [id, entries.current.get(id)] as const)
    .filter((pair): pair is readonly [string, Entry] => pair[1] !== undefined);

  return (
    <ToolbarContext value={context}>
      <BaseToolbar
        ref={root}
        aria-label={label}
        loop={false}
        className={cn(
          'flex w-full min-w-0 items-center gap-1 overflow-hidden rounded-control border border-border-default bg-bg-surface p-1',
          'font-ui text-text-default',
          className,
        )}
      >
        {children}
        {overflow.length > 0 && (
          <Menu
            onAction={(id) => {
              entries.current.get(id)?.onClick?.();
            }}
          >
            <BaseToolbarButton
              data-toolbar-id="__more"
              render={<BaseMenuTrigger />}
              aria-label={moreLabel}
              className={cn(
                ITEM,
                buttonClasses({ variant: 'ghost', iconOnly: true }),
                'text-text-default',
              )}
            >
              <Icon name="dots" />
            </BaseToolbarButton>
            <MenuContent>
              {overflow.map(([id, entry]) => (
                <MenuItem
                  key={id}
                  value={id}
                  {...(entry.icon === undefined ? {} : { icon: entry.icon })}
                  disabled={entry.disabled}
                >
                  {entry.label}
                </MenuItem>
              ))}
            </MenuContent>
          </Menu>
        )}
      </BaseToolbar>
    </ToolbarContext>
  );
}

export interface ToolbarButtonProps {
  /** The label; also the item's text in «المزيد» when it does not fit. */
  children: string;
  icon?: IconName;
  /** A toggle that is on: `aria-pressed`, the selected tint. */
  pressed?: boolean;
  /** Skipped by the arrows and never pressed. */
  disabled?: boolean;
  onClick?: (event?: MouseEvent<HTMLElement>) => void;
}

export function ToolbarButton({
  children,
  icon,
  pressed,
  disabled = false,
  onClick,
}: ToolbarButtonProps) {
  const context = useContext(ToolbarContext);
  const id = useId();
  const register = context?.register;
  useLayoutEffect(() => {
    if (register === undefined) return undefined;
    return register(id, {
      label: children,
      icon,
      disabled,
      onClick:
        onClick === undefined
          ? undefined
          : () => {
              onClick();
            },
    });
  }, [register, id, children, icon, disabled, onClick]);
  if (context?.hidden.has(id) === true) return <span data-toolbar-slot={id} hidden />;
  return (
    <BaseToolbarButton
      data-toolbar-id={id}
      data-toolbar-slot={id}
      disabled={disabled}
      focusableWhenDisabled={false}
      {...(pressed === undefined ? {} : { 'aria-pressed': pressed })}
      {...(onClick === undefined ? {} : { onClick })}
      className={ITEM}
    >
      {icon !== undefined && <Icon name={icon} />}
      {children}
    </BaseToolbarButton>
  );
}

/** A vertical line between groups of buttons. */
export function ToolbarSeparator() {
  return <BaseToolbarSeparator className="mx-1 h-6 w-px shrink-0 self-center bg-border-default" />;
}
