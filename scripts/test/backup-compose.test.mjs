// Spec 0.2-09c criterion 1: the local backup stack is pinned, local-only and secret-free.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { parse } from 'yaml';
import { POSTGRES_IMAGE_TAG } from '../lib/backup-env.mjs';

const root = join(import.meta.dirname, '..', '..');
const dir = join(root, 'infra', 'backup');
const compose = parse(readFileSync(join(dir, 'compose.yml'), 'utf8'));
const services = Object.entries(compose.services ?? {});
const dockerfile = readFileSync(join(dir, 'postgres', 'Dockerfile'), 'utf8');
const harnessImage = readFileSync(join(root, 'packages', 'db', 'test-harness', 'image.ts'), 'utf8');

const SECRET_NAME = /PASSWORD|SECRET|TOKEN|KEY|PASS/;
const REFERENCE = /^\$\{[A-Z][A-Z0-9_]*:\?[^}]*\}$/;
const PINNED = /^([a-z0-9./-]+):([A-Za-z0-9._-]+)@sha256:[0-9a-f]{64}$/;

describe('backup compose file', () => {
  it('defines PostgreSQL, Garage and the TLS proxy in project shifa-backup', () => {
    assert.equal(compose.name, 'shifa-backup');
    assert.deepEqual(services.map(([name]) => name).sort(), ['garage', 'garage-tls', 'postgres']);
  });

  it('pins every pulled image by version and sha256 digest, never latest', () => {
    for (const [name, service] of services) {
      if (name === 'postgres') continue; // built from the Dockerfile below
      const image = String(service.image ?? '');
      const match = PINNED.exec(image);
      assert.ok(match, `${name}: image "${image}" is not name:version@sha256:digest`);
      assert.notEqual(match[2], 'latest', `${name}: tag latest`);
      assert.match(match[2], /\d/, `${name}: tag "${match[2]}" names no version`);
    }
  });

  it('builds PostgreSQL from the harness digest with an exact pgBackRest version', () => {
    const from = /^FROM (\S+)$/m.exec(dockerfile)?.[1];
    assert.ok(from && PINNED.test(from), `FROM "${from}" is not pinned by digest`);
    assert.ok(harnessImage.includes(`'${from}'`), 'FROM differs from test-harness/image.ts');
    assert.match(dockerfile, /pgbackrest=\d+\.\d+\.\d+-\S+/, 'pgbackrest version not exact');
    assert.match(dockerfile, /--no-install-recommends/);
    const postgres = compose.services.postgres;
    assert.deepEqual(postgres.build, { context: './postgres' });
    assert.equal(postgres.image, POSTGRES_IMAGE_TAG, 'scripts and compose name the same image');
    const pgbackrest = /pgbackrest=(\d+\.\d+\.\d+)/.exec(dockerfile)?.[1];
    assert.ok(POSTGRES_IMAGE_TAG.endsWith(`-${pgbackrest}`), 'image tag names the pgBackRest pin');
  });

  it('publishes only PostgreSQL, on 127.0.0.1', () => {
    const publishing = [];
    for (const [name, service] of services) {
      const ports = service.ports ?? [];
      if (ports.length > 0) publishing.push(name);
      for (const port of ports) {
        assert.equal(typeof port, 'string', `${name}: use the short "127.0.0.1:host:container"`);
        assert.match(port, /^127\.0\.0\.1:\d+:\d+$/, `${name}: port "${port}"`);
      }
      assert.equal(service.network_mode, undefined, `${name}: network_mode`);
      assert.notEqual(service.privileged, true, `${name}: privileged`);
    }
    assert.deepEqual(publishing, ['postgres']);
    assert.deepEqual(compose.services.postgres.ports, ['127.0.0.1:55432:5432']);
  });

  it('takes every secret from ${VAR:?} references, never a literal', () => {
    for (const [name, service] of services) {
      const env = service.environment ?? {};
      assert.ok(!Array.isArray(env), `${name}: use the map form of environment`);
      for (const [key, value] of Object.entries(env)) {
        if (SECRET_NAME.test(key)) {
          assert.match(String(value), REFERENCE, `${name}.${key} is not a \${VAR:?} reference`);
        }
      }
    }
    const text = readFileSync(join(dir, 'compose.yml'), 'utf8').replace(
      /@sha256:[0-9a-f]{64}/g,
      '',
    );
    assert.doesNotMatch(text, /[0-9a-f]{32}/, 'a hex literal that looks like a secret');
  });

  it('gives every service a healthcheck so up --wait works', () => {
    for (const [name, service] of services)
      assert.ok(service.healthcheck, `${name}: no healthcheck`);
  });

  it('archives WAL through pgBackRest every 60 s at most (criterion 2)', () => {
    const command = compose.services.postgres.command.join(' ');
    assert.match(command, /wal_level=replica/);
    assert.match(command, /archive_mode=on/);
    assert.match(command, /archive_command=pgbackrest --stanza=shifa archive-push %p/);
    assert.match(command, /archive_timeout=60s/);
  });
});
