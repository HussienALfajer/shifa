// Spec 0.2-09b criterion 9: one starter dashboard, provisioned from the repository.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { parse } from 'yaml';

const dir = join(import.meta.dirname, '..', '..', 'infra', 'observability', 'grafana');
const dashboard = JSON.parse(readFileSync(join(dir, 'dashboards', 'shifa-api.json'), 'utf8'));
const datasources = parse(
  readFileSync(join(dir, 'provisioning', 'datasources', 'shifa.yaml'), 'utf8'),
);
const providers = parse(
  readFileSync(join(dir, 'provisioning', 'dashboards', 'shifa.yaml'), 'utf8'),
);

const uids = new Map((datasources.datasources ?? []).map((d) => [d.uid, d]));
const panels = dashboard.panels ?? [];

describe('Grafana provisioning', () => {
  it('provisions Prometheus, Loki and Tempo with fixed uids', () => {
    const types = [...uids.values()].map((d) => `${d.type}:${d.uid}`).sort();
    assert.deepEqual(types, [
      'loki:shifa-loki',
      'prometheus:shifa-prometheus',
      'tempo:shifa-tempo',
    ]);
    for (const d of uids.values())
      assert.match(String(d.url), /^http:\/\/(localhost|127\.0\.0\.1):\d+/);
  });

  it('links Tempo traces to Loki logs on trace_id', () => {
    const tempo = uids.get('shifa-tempo');
    assert.equal(tempo.jsonData?.tracesToLogsV2?.datasourceUid, 'shifa-loki');
    assert.match(JSON.stringify(tempo.jsonData.tracesToLogsV2), /trace_id/);
  });

  it('loads dashboards from the mounted repository folder', () => {
    const [provider] = providers.providers ?? [];
    assert.ok(provider, 'no dashboard provider');
    assert.equal(provider.type, 'file');
    assert.ok(provider.options?.path, 'provider path');
  });
});

describe('shifa-api dashboard', () => {
  it('has a fixed uid and the three starter panels', () => {
    assert.equal(dashboard.uid, 'shifa-api');
    const titles = panels.map((p) => p.title.toLowerCase());
    for (const wanted of ['request rate', 'error rate', 'p95 latency']) {
      assert.ok(
        titles.some((t) => t.includes(wanted)),
        `no "${wanted}" panel in ${titles}`,
      );
    }
  });

  it('queries only provisioned datasources', () => {
    for (const panel of panels) {
      assert.ok(
        uids.has(panel.datasource?.uid),
        `${panel.title}: datasource ${panel.datasource?.uid}`,
      );
      for (const target of panel.targets ?? []) {
        assert.ok(
          uids.has(target.datasource?.uid ?? panel.datasource.uid),
          `${panel.title}: target datasource`,
        );
      }
    }
  });

  it('groups by the route template only (no id, tenant or user label)', () => {
    for (const panel of panels) {
      for (const target of panel.targets ?? []) {
        const groups = [...String(target.expr).matchAll(/\bby\s*\(([^)]*)\)/g)].map((m) =>
          m[1]
            .split(',')
            .map((label) => label.trim())
            .filter((label) => label !== 'le'),
        );
        assert.ok(groups.length > 0, `${panel.title}: no grouping`);
        for (const labels of groups)
          assert.deepEqual(labels, ['http_route'], `${panel.title}: ${target.expr}`);
        const selectors = [...String(target.expr).matchAll(/([a-z_]+)\s*(=~|!=|=)/g)].map(
          (m) => m[1],
        );
        for (const label of selectors) {
          assert.ok(
            ['http_route', 'http_response_status_class', 'service_name', 'job'].includes(label),
            label,
          );
        }
      }
    }
  });
});
