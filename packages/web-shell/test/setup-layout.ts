// happy-dom has no layout: every element measures 0 × 0, so the data table's virtual rows (TanStack
// Virtual reads the scroll box's clientHeight) would draw none. The table's scroll box gets the
// height of a desktop table here; geometry itself is checked in the browser tests and e2e.
const TABLE_HEIGHT = 640;
const TABLE_WIDTH = 1024;

const isTableScroll = (el: Element) => el.getAttribute('data-slot') === 'data-table-scroll';

for (const [prop, size] of [
  ['clientHeight', TABLE_HEIGHT],
  ['clientWidth', TABLE_WIDTH],
] as const) {
  const native = Object.getOwnPropertyDescriptor(Element.prototype, prop);
  Object.defineProperty(HTMLElement.prototype, prop, {
    configurable: true,
    get(this: HTMLElement) {
      if (isTableScroll(this)) return size;
      return (native?.get?.call(this) as number | undefined) ?? 0;
    },
  });
}
