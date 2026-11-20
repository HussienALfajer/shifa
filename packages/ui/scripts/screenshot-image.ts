// The browser image the screenshots of packages/ui render in (slice 0.4-03): Playwright's image at
// the version of the `playwright` and `@playwright/test` pins, by digest, so every machine and CI
// draws the same pixels. Change it only with those pins, in the same PR, and refresh the baselines.
//   node packages/ui/scripts/screenshot-image.ts    prints the reference (CI pulls it)
export const PLAYWRIGHT_IMAGE =
  'mcr.microsoft.com/playwright:v1.65.1-noble@sha256:1507cbfc550a63a6b7396791ca4f00df17beb56342d2447b3f106c306f525579';

/** The Playwright version of the image, for `playwright run-server` inside it. */
export const PLAYWRIGHT_VERSION = /:v(\d+\.\d+\.\d+)-/.exec(PLAYWRIGHT_IMAGE)?.[1] ?? '';

if (import.meta.main) process.stdout.write(`${PLAYWRIGHT_IMAGE}\n`);
