# Observability (local stack)

Status: current · Spec: [0.2-09b](../specs/foundation/0.2-09b-observability-skeleton.md) · Requirement: PLT-52 · Decisions: [ADR-0029](../adr/0029-backup-targets-and-local-operations-stack.md), ADR-0022 (proposed) · Slices: [0.2-09b1](../slices/0.2-09b1-api-telemetry.md), [0.2-09b2](../slices/0.2-09b2-error-reporting.md), [0.2-09b3](../slices/0.2-09b3-local-observability-stack.md)

The API (`apps/api`) exports traces, metrics and logs over OTLP and error events through the Sentry SDK. Locally they go to a Docker Compose stack in [`infra/observability/`](../../infra/observability/README.md): an OpenTelemetry Collector, `grafana/otel-lgtm` (Grafana, Loki, Tempo, Prometheus) and GlitchTip. Every port is bound to `127.0.0.1`; nothing leaves the machine. Staging and production wait for OD-01.

Without the stack nothing changes: telemetry is off unless `OTEL_EXPORTER_OTLP_ENDPOINT` or `SENTRY_DSN` is set, and tests run without it.

## Run it
| Command | What it does |
|---|---|
| `pnpm obs:up` | First run: writes `infra/observability/.env` (git-ignored, mode `0600`) with a random GlitchTip secret key, admin password, database password and API token; never prints them. Starts the stack and waits for health, then creates the GlitchTip admin, organisation `shifa-local`, project `shifa-api` and API token, and stores the project DSN in the same `.env`. Later runs reuse the file. Prints the two URLs. |
| `pnpm obs:smoke` | Builds the API, boots it against a throwaway PostgreSQL with telemetry on, calls `/health/ready` and the test-only `/_test/fail`, and checks within 60 s that the trace (Tempo), the log lines (Loki), the request metric (Prometheus) and one error event (GlitchTip) arrived, and that the failing route's synthetic marker reached none of them. Docker must be running. |
| `pnpm obs:down` | Stops the stack; data is kept. |
| `pnpm obs:reset --yes` | Deletes the containers, all stored telemetry and the `.env` (new secrets on the next `up`). Without `--yes` it does nothing. |

To send your own API's telemetry to the stack, add to `apps/api/.env` (values from `.env.example`): `OTEL_EXPORTER_OTLP_ENDPOINT=http://127.0.0.1:4318` and `SENTRY_DSN=<GLITCHTIP_DSN from infra/observability/.env>`.

Under WSL2 the sandbox blocks Docker (OD-24): run `obs:*` in your own terminal, not in a sandboxed Claude Code session.

## Where to look
| What | Where |
|---|---|
| Dashboard *Shifa API* (request rate, 5xx rate, p95 latency by route template) | Grafana <http://127.0.0.1:3300>, folder *Shifa* |
| Traces | Grafana → Explore → Tempo; search by trace id or `service.name = shifa-api` |
| Logs | Grafana → Explore → Loki: `{service_name="shifa-api"}` |
| Metrics | Grafana → Explore → Prometheus: `http_server_request_duration_seconds_count`, `http_server_request_count_total` |
| Errors | GlitchTip <http://127.0.0.1:8000>, user `admin@shifa.localhost`, password `GLITCHTIP_ADMIN_PASSWORD` in `infra/observability/.env` |

Grafana in otel-lgtm signs everyone in as admin; that is acceptable only because it is bound to `127.0.0.1` on a development machine.

## Following one request
1. An error response carries no internals; take the `requestId` from the API's stdout line or the client's log.
2. Loki: `{service_name="shifa-api"} | requestId="<id>"` (or `reqId` on Fastify's request lines). Every line inside a request also carries `trace_id`.
3. Tempo: open the trace by that `trace_id`; *Logs for this span* jumps back to Loki.
4. GlitchTip: search the issue's events by the tag `trace_id:<id>` or `request_id:<id>`.

## The two scrubbing layers (PLT-52)
1. **In the API (allowlist).** [`apps/api/src/telemetry/scrub.ts`](../../apps/api/src/telemetry/scrub.ts) lets a span attribute, metric label or resource attribute out only if its key is listed; exception messages become the error class; `tracestate` is dropped. Error events pass `beforeSend` in `errors.ts` (class, code, stack frames and listed tags only). Log lines are sanitised by `platform/logging.ts` before they reach stdout or OTLP. The leak test (`apps/api/test/telemetry/telemetry-leak.test.ts`) sends synthetic patient data in body, query, headers and cookie and searches every export for it.
2. **In the Collector (denylist, then allowlist).** [`infra/observability/collector.yaml`](../../infra/observability/collector.yaml): `resource/deny` and `attributes/deny` delete the denied keys of spec criterion 6 again (bodies, URLs and query strings, client addresses, cookies and every header except the request content type, database statements and parameters, exception messages, `enduser.*`); `redaction` then removes every key not on its allowlist and masks values that look like an e-mail address, a bearer token or a JWT. Log bodies are not transformed. `scripts/test/obs-collector-run.test.mjs` runs the pinned Collector image on a fixture holding every denied key and proves they are gone.

## Adding an attribute safely
1. Decide that the value can never hold personal or clinical data: an enumeration, a route template, a status, a duration or an opaque UUID. Names, phones, free text, URLs and query strings never qualify.
2. Add the key to the right set in `scrub.ts` (span, metric label or resource). Opaque ids also go in `UUID_ATTRIBUTES` so non-UUID values are dropped.
3. Add a synthetic value of the new field to the leak test, so a mistake shows up as a leak.
4. Add the key to `redaction.allowed_keys` in `collector.yaml`; `obs-collector-config.test.mjs` fails until scrub.ts and the Collector agree. Check that the key is not on the deny lists, and that no deny pattern should now cover a neighbour of it.
5. A new log field: list it in `redaction.allowed_keys` too, or it stays on stdout only.
6. Metric labels: never an id of any kind (cardinality and identification).

## Updating images
Pin `name:version@sha256:digest` in `compose.yml` (the compose test refuses anything else). Read the digest from `docker buildx imagetools inspect <image>:<version>` in a shell that reaches Docker, then run `pnpm obs:reset --yes`, `pnpm obs:up` and `pnpm obs:smoke`. The Collector's `redaction` semantics have changed between releases: the run test on the new image is the proof.
