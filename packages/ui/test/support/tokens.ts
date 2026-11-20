/**
 * The computed colour of the token custom property `name` where `within` sits (its theme and
 * density apply), in the browser's `rgb(…)` form, to compare with a computed style.
 */
export function tokenColor(name: `--shifa-${string}`, within: Element): string {
  const probe = document.createElement('span');
  probe.style.color = `var(${name})`;
  (within.parentElement ?? within).appendChild(probe);
  const color = getComputedStyle(probe).color;
  probe.remove();
  return color;
}
