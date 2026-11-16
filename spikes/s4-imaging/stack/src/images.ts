// Criterion 1: every image the spike runs, pinned by version and digest (multi-arch index
// digest). Each release was at least 24 hours old when pinned (2026-11-16). The Dockerfiles in
// link/, gateway/ and generator/ use the same strings in FROM; images.test.ts checks them.

export const IMAGES = {
  /** Official Orthanc image: PostgreSQL index, AWS S3 storage, DICOMweb, Transfers, GDCM. */
  orthanc:
    'orthancteam/orthanc:26.11.0@sha256:06b8baab0c63cd58de5474a74b64096a82ea3f7eab2aa471e217cc48c9ae11bf',
  /** Same PostgreSQL 18 pin as packages/db and the backup stack. */
  postgres:
    'postgres:18.6-trixie@sha256:e3d24f6906d0760bf4da0dae872415391ededefad23fd471c47dc53b0ddf3c42',
  /** Same Garage pin as the backup stack (ADR-0021). */
  garage:
    'dxflrs/garage:v2.5.0@sha256:677e5b758e4425a325b811c425c026bf35a4bf42f7ddbaa773de3f4fd779a5a5',
  /** Unmodified OHIF v3 release build (used by 0.3-S4b). */
  ohif: 'ohif/app:v3.13.14@sha256:40e509850ffaa45db50e64122387a8592b2b82965003568bd8f19f1cfb5ff2d3',
  /** Browser on the clinic network; same Playwright version as the workspace. */
  playwright:
    'mcr.microsoft.com/playwright:v1.65.1-noble@sha256:1507cbfc550a63a6b7396791ca4f00df17beb56342d2447b3f106c306f525579',
  /** Base of the link shaper (iproute2 + HAProxy). */
  alpine: 'alpine:3.24.4@sha256:f59abe656b692d901e184be3445e084786602108599d2a51d229c0f5a48c71bf',
  /** Base of the gateway and the link test's byte sink. */
  node: 'node:24.22.3-slim@sha256:dc26ae92c9fb15cf6b1d63e20f0944b2efe0f115b20e00be48fb23fceb061c54',
  /** Base of the dcmtk tools image (dcmmkdir here, storescu in 0.3-S4b). */
  debian:
    'debian:trixie-20261104-slim@sha256:a72b4433de1cf7d6bae0c4cee74d0547f58601a643b3375f070c51600d63b6b2',
} as const;

export type ImageKey = keyof typeof IMAGES;

/** `name:version@sha256:<64 hex>`. */
export const PINNED_IMAGE = /^[a-z0-9./_-]+:[\w.-]+@sha256:[0-9a-f]{64}$/;

/**
 * Exactly what `/plugins` must list, by the names Orthanc reports. Anything else loaded
 * (Python, Lua, extra plugins) fails the check; OrthancExplorer2 is switched off.
 * - `postgresql-storage` comes with `postgresql-index` (the image loads both libraries of the
 *   official PostgreSQL plugin); `EnableStorage: false` keeps it inactive.
 * - `explorer.js` is not a plugin: the core always lists the explorer extension entry.
 */
export const REQUIRED_ORTHANC_PLUGINS = [
  'AWS S3 Storage',
  'dicom-web',
  'explorer.js',
  'gdcm',
  'postgresql-index',
  'postgresql-storage',
  'transfers',
] as const;
