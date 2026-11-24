// happy-dom has no layout: every element measures 0 × 0, so the data table's virtual rows (TanStack
// Virtual reads the scroll box's clientHeight) would draw none. The table's scroll box gets the
// height of a desktop table here; geometry itself is checked in the browser tests and e2e.
const TABLE_HEIGHT = 640;
const TABLE_WIDTH = 1024;

const isTableScroll = (el: Element) => el.getAttribute('data-slot') === 'data-table-scroll';

// A cancelled animation rejects its `finished` promise; browsers mark that rejection as handled
// (Web Animations, "reset an animation's pending tasks"), happy-dom does not. The menu's sheet
// (A-01-08 switcher on a phone) cancels its animation on close: without this, an unhandled
// rejection fails the run although nothing went wrong.
const cancelAnimation = Object.getOwnPropertyDescriptor(Animation.prototype, 'cancel')?.value as
  | ((this: Animation) => void)
  | undefined;
Animation.prototype.cancel = function cancel(this: Animation) {
  this.finished.catch(() => undefined);
  cancelAnimation?.call(this);
};

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
