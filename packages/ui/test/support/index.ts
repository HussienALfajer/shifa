// Test helpers for @shifa/ui components (slice 0.4-03), used by the RTL gate of 0.4-04.
// test/helpers.test.tsx proves each one fails on a deliberately wrong fixture.
export { expectAxeClean } from './axe.ts';
export { type Align, expectPopupSide, type Side } from './geometry.ts';
export { arrows, expectArrow, expectDigitsAccepted, typeArabic } from './keyboard.ts';
export { type Region, renderDir } from './render.tsx';
export { tokenColor } from './tokens.ts';
