// A tiny element builder and Arabic-Indic digits for the page.

type Attrs = Record<string, string | boolean | undefined | ((e: Event) => void)>;

export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Attrs = {},
  ...children: (Node | string | null | undefined | false)[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [name, value] of Object.entries(attrs)) {
    if (value === undefined || value === false) continue;
    if (typeof value === 'function') el.addEventListener(name.replace(/^on/u, ''), value);
    else if (value === true) el.setAttribute(name, '');
    else el.setAttribute(name, value);
  }
  for (const child of children) {
    if (child === null || child === undefined || child === false) continue;
    el.append(child);
  }
  return el;
}

const DIGITS = '٠١٢٣٤٥٦٧٨٩';

export function arabicDigits(n: number): string {
  return String(n).replace(/\d/gu, (d) => DIGITS[Number(d)] ?? d);
}

export function button(
  label: string,
  testId: string,
  onClick: () => void,
  opts: { pressed?: boolean; disabled?: boolean; className?: string; ariaLabel?: string } = {},
): HTMLButtonElement {
  return h(
    'button',
    {
      type: 'button',
      'data-testid': testId,
      class: opts.className,
      'aria-pressed': opts.pressed === undefined ? undefined : String(opts.pressed),
      'aria-label': opts.ariaLabel,
      disabled: opts.disabled,
      onclick: () => {
        onClick();
      },
    },
    label,
  );
}
