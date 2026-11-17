// Criterion 1: every image the spike runs, pinned by version and digest (multi-arch index
// digest, as Docker Hub lists it). Each release was at least 24 hours old when pinned
// (2026-11-17).
//
// Licences found (spec question, for the 0.3-S5c report): the image carries no WAHA licence
// file; /app/package.json says "license": "UNLICENSED"; the only LICENSE files are Node's
// (/usr/local/LICENSE) and Yarn's. The GOWS engine ships as the binary /app/gows with no licence
// file next to it. The public repository devlikeapro/waha (WAHA Core) is the reference for the
// licence question; the GOWS licence is unclear from the image alone.

/** WAHA release pinned for the spike (latest 2026.x free release at slice start). */
export const WAHA_VERSION = '2026.10.1';

export const IMAGES = {
  /** WAHA Core, GOWS-only build (`gows-<version>`): GOWS is the default engine in its env. */
  waha: `devlikeapro/waha:gows-${WAHA_VERSION}@sha256:1f7faeb0227ad5edb5711f7058bfce807ea65e5f92234af0778e4db140f6eb46`,
  /** Same PostgreSQL 18 pin as packages/db and the 0.3-S4 stack. */
  postgres:
    'postgres:18.6-trixie@sha256:e3d24f6906d0760bf4da0dae872415391ededefad23fd471c47dc53b0ddf3c42',
  /** One-shot HTTP probe on a chosen network (same Node pin as the 0.3-S4 gateway). */
  node: 'node:24.22.3-slim@sha256:dc26ae92c9fb15cf6b1d63e20f0944b2efe0f115b20e00be48fb23fceb061c54',
} as const;

export type ImageKey = keyof typeof IMAGES;

/** `name:version@sha256:<64 hex>`. */
export const PINNED_IMAGE = /^[a-z0-9./_-]+:[\w.-]+@sha256:[0-9a-f]{64}$/;
