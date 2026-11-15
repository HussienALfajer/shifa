// Every container image of the scenario suite, pinned by tag and digest (at least 24 hours old).
// PostgreSQL and Ryuk are the same images as packages/db/test-harness/image.ts.
export const IMAGES = {
  postgres:
    'postgres:18.6-trixie@sha256:e3d24f6906d0760bf4da0dae872415391ededefad23fd471c47dc53b0ddf3c42',
  toxiproxy:
    'ghcr.io/shopify/toxiproxy:2.13.0@sha256:5d3dae09bc185dcc5ff6cf43abf6062a4a720aff0c4306a471e773acdcd107aa',
  powersync:
    'journeyapps/powersync-service:1.28.3@sha256:effc8cfae91dcb2d4b5767b3b0a795d933701aa957a81af2bfce7fb15c2f47b4',
  // Testcontainers' own helpers: the reaper and the port forwarder behind exposeHostPorts().
  ryuk: 'testcontainers/ryuk:0.14.0@sha256:7c1a8a9a47c780ed0f983770a662f80deb115d95cce3e2daa3d12115b8cd28f0',
  sshd: 'testcontainers/sshd:1.4.0@sha256:bdae17f702908bee93c877ab3e97eddd782e2fb5bdd23a9f29869b9a87b30acd',
} as const;

export const PINNED = /^[a-z0-9./_-]+:[\w.-]+@sha256:[0-9a-f]{64}$/;

/** Testcontainers reads these when its modules load: call before importing them. */
export function pinTestcontainersHelpers(): void {
  process.env['RYUK_CONTAINER_IMAGE'] ??= IMAGES.ryuk;
  process.env['SSHD_CONTAINER_IMAGE'] ??= IMAGES.sshd;
}
