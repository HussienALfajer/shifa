// Tiny DOM helpers for the throwaway prototype (no framework).
type Attrs = Record<string, string | boolean | ((ev: Event) => void) | undefined>;

export function h(
  tag: string,
  attrs: Attrs = {},
  ...children: (Node | string | undefined)[]
): HTMLElement {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === false) continue;
    if (typeof v === 'function') el.addEventListener(k.replace(/^on/, ''), v);
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, v);
  }
  for (const c of children) if (c !== undefined) el.append(c);
  return el;
}

/** Children for append()/replaceChildren() without the undefined holes. */
export function kids(...items: (Node | string | undefined)[]): (Node | string)[] {
  return items.filter((x): x is Node | string => x !== undefined);
}

export function field(form: HTMLFormElement, name: string): string {
  const value = new FormData(form).get(name);
  return typeof value === 'string' ? value : '';
}

/** "12.50" → "1250" minor units, without floats; undefined when malformed or not positive. */
export function toMinor(text: string): string | undefined {
  const m = /^(\d{1,15})(?:[.,](\d{1,2}))?$/.exec(text.trim());
  if (!m) return undefined;
  const minor = BigInt(m[1] ?? '0') * 100n + BigInt((m[2] ?? '').padEnd(2, '0'));
  return minor > 0n ? minor.toString() : undefined;
}

export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const hh = Math.floor(total / 3600);
  const mm = Math.floor((total % 3600) / 60);
  const ss = total % 60;
  return `${String(hh)}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
}

/** The clinic's date (Asia/Damascus), as the server counts "today". */
export function clinicToday(now = Date.now()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Damascus' }).format(new Date(now));
}
