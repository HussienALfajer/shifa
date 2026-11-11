// Spec 0.2-09b criterion 8: the local observability stack is pinned, local-only and secret-free.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { parse } from 'yaml';

const dir = join(import.meta.dirname, '..', '..', 'infra', 'observability');
const compose = parse(readFileSync(join(dir, 'compose.yml'), 'utf8'));
const services = Object.entries(compose.services ?? {});

/** The only services reachable from the host: Collector, Grafana stack, GlitchTip web. */
const PUBLISHED = ['collector', 'glitchtip-web', 'lgtm'];
const SECRET_NAME = /PASSWORD|SECRET|TOKEN|KEY|DSN/;
const REFERENCE = /^\$\{[A-Z][A-Z0-9_]*:\?[^}]*\}$/;

const environmentOf = (service) => {
  const env = service.environment ?? {};
  if (!Array.isArray(env)) return Object.entries(env).map(([k, v]) => [k, String(v ?? '')]);
  return env.map((entry) => {
    const at = entry.indexOf('=');
    return at === -1 ? [entry, ''] : [entry.slice(0, at), entry.slice(at + 1)];
  });
};

describe('observability compose file', () => {
  it('defines the Collector, otel-lgtm and GlitchTip with its database and Valkey', () => {
    const names = services.map(([name]) => name).sort();
    assert.deepEqual(names, [
      'collector',
      'glitchtip-postgres',
      'glitchtip-valkey',
      'glitchtip-web',
      'glitchtip-worker',
      'lgtm',
    ]);
  });

  it('pins every image by version and sha256 digest, never latest', () => {
    for (const [name, service] of services) {
      const image = String(service.image ?? '');
      const match = /^([a-z0-9./-]+):([A-Za-z0-9._-]+)@sha256:[0-9a-f]{64}$/.exec(image);
      assert.ok(match, `${name}: image "${image}" is not name:version@sha256:digest`);
      assert.notEqual(match[2], 'latest', `${name}: tag latest`);
      assert.match(match[2], /\d/, `${name}: tag "${match[2]}" names no version`);
      assert.equal(service.build, undefined, `${name}: builds an image instead of pinning one`);
    }
  });

  it('binds every published port to 127.0.0.1 and publishes only the listed services', () => {
    const publishing = [];
    for (const [name, service] of services) {
      const ports = service.ports ?? [];
      if (ports.length > 0) publishing.push(name);
      for (const port of ports) {
        assert.equal(
          typeof port,
          'string',
          `${name}: use the short "127.0.0.1:host:container" form`,
        );
        assert.match(port, /^127\.0\.0\.1:\d+:\d+$/, `${name}: port "${port}"`);
      }
      assert.equal(service.network_mode, undefined, `${name}: network_mode`);
      assert.notEqual(service.privileged, true, `${name}: privileged`);
      assert.equal(service.expose, undefined, `${name}: expose (use the compose network)`);
    }
    assert.deepEqual(publishing.sort(), PUBLISHED);
  });

  it('keeps Grafana off host port 3000 (the API default)', () => {
    for (const [name, service] of services) {
      for (const port of service.ports ?? []) {
        assert.notEqual(String(port).split(':')[1], '3000', `${name}: host port 3000`);
      }
    }
    const lgtmPorts = (compose.services.lgtm.ports ?? []).map(String);
    assert.ok(lgtmPorts.includes('127.0.0.1:3300:3000'), 'Grafana is on 127.0.0.1:3300');
  });

  it('never publishes the otel-lgtm OTLP ports (only the Collector receives telemetry)', () => {
    const lgtmPorts = (compose.services.lgtm.ports ?? []).map((p) => String(p).split(':')[2]);
    assert.ok(!lgtmPorts.includes('4317') && !lgtmPorts.includes('4318'), String(lgtmPorts));
    const collectorPorts = (compose.services.collector.ports ?? []).map(String).sort();
    assert.deepEqual(collectorPorts, ['127.0.0.1:4317:4317', '127.0.0.1:4318:4318']);
  });

  it('holds no secret literal: secret-named keys and URL passwords are ${VAR:?} references', () => {
    for (const [name, service] of services) {
      for (const [key, value] of environmentOf(service)) {
        if (SECRET_NAME.test(key)) {
          assert.match(value, REFERENCE, `${name}: ${key} must be a \${VAR:?} reference`);
        }
        const password = /^[a-z][a-z0-9+]*:\/\/[^/@:]*:([^@]*)@/.exec(value);
        if (password) {
          assert.match(password[1], REFERENCE, `${name}: ${key} holds a URL password literal`);
        }
      }
    }
  });

  it('gives every long-running service a healthcheck so `up --wait` means ready', () => {
    // The Collector image is distroless (no shell, no curl): Compose waits for it to run.
    for (const [name, service] of services) {
      if (name === 'collector') continue;
      assert.ok(service.healthcheck?.test, `${name}: no healthcheck`);
    }
  });

  it('keeps data in named volumes declared at the top level', () => {
    const declared = new Set(Object.keys(compose.volumes ?? {}));
    for (const [name, service] of services) {
      for (const volume of service.volumes ?? []) {
        const source = String(volume).split(':')[0];
        if (source.startsWith('.')) {
          assert.match(String(volume), /:ro$/, `${name}: bind mount "${volume}" is not read-only`);
          continue;
        }
        assert.ok(declared.has(source), `${name}: volume "${source}" is not a named volume`);
      }
    }
  });
});
