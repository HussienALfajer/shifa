// The harness pins every image by tag and digest (supply chain; CI pulls the same bytes).
import { expect, test } from '@playwright/test';
import { IMAGES, PINNED } from '../harness/images.ts';

test('every container image is pinned by digest', () => {
  for (const [name, image] of Object.entries(IMAGES)) expect(image, name).toMatch(PINNED);
});
