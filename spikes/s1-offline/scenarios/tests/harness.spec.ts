// The harness pins every image by tag and digest (supply chain; CI pulls the same bytes).
import { expect, test } from '@playwright/test';
import { IMAGES, PINNED } from '../harness/images.ts';
import { prototypeDir } from '../harness/stack.ts';

test('every container image is pinned by digest', () => {
  for (const [name, image] of Object.entries(IMAGES)) expect(image, name).toMatch(PINNED);
});

test('the Flutter probe stack builds no web prototype', () => {
  const build = () => {
    throw new Error('the prototype was built');
  };
  expect(prototypeDir('outbox', { prototype: false }, build)).toBeUndefined();
  expect(prototypeDir('powersync', { prototype: true }, () => 'dist')).toBe('dist');
});
