# Prometheus Metrics for Wayfinder — Design

**Date:** 2026-07-02
**Status:** Approved

## Goal

Expose Prometheus metrics from Wayfinder on a secondary, internal-only HTTP
server, mirroring the pattern already shipped in the OneBusAway Twilio app
(Go). The metrics server binds a different port than the app so it can be kept
inside the VPC while the app port is public.

Dashboards must be able to show: process/system CPU, memory used vs. capacity,
p50/p90/p99 HTTP response times, and requests per minute.

## Library

`prom-client@15.x`. The GitHub project `prometheus/client_js` is the official
Prometheus-org home of this library (renamed in-repo to `@prometheus/client`),
but the scoped package is not yet published to npm — `prom-client` is the
published name for the identical code. When `@prometheus/client` ships, the
migration is a dependency rename.

## Parity with the Twilio app

- Default metrics port: **9119**, configurable via `METRICS_PORT`.
- Port resolution semantics: empty/unset → default; non-numeric or outside
  1–65535 → log a warning and use the default.
- Metric names and labels:
  - `http_requests_total{method, route, status}` (counter)
  - `http_request_duration_seconds{method, route}` (histogram, default buckets)
- Dedicated (non-global) registry with runtime/process collectors registered.

## Architecture

Wayfinder is SvelteKit 5 on `adapter-node`, so all pieces are server-side:

1. **`src/lib/metrics/registry.js`** — server-only module. Creates a
   `prom-client` `Registry` with:
   - `collectDefaultMetrics()` → process CPU, RSS, heap used/total, event-loop
     lag, GC durations, Node version.
   - The two HTTP metrics above.
   - System-level gauges (via `node:os`, computed in `collect()` at scrape
     time): `system_cpu_load_average_1m`, `system_memory_total_bytes`,
     `system_memory_free_bytes` — so "System CPU" and "Memory used of
     capacity" panels work without node_exporter.
   - The singleton is stored on `globalThis` so dev-mode HMR re-evaluation
     neither double-registers metrics nor orphans the registry held by the
     running metrics server.
   - Exports `recordHttpRequest({method, route, status, durationSeconds})`,
     `renderMetrics()`, `metricsContentType`, and `resolveMetricsPort(raw)`.
2. **`src/lib/metrics/server.js`** — `startMetricsServer(port)` starts a plain
   `node:http` server answering `GET /metrics` (anything else → 404). Guarded
   by a `globalThis` flag against double-starts (dev HMR); `EADDRINUSE` and
   other listen errors are logged, never crash the app.
3. **`src/hooks.server.js`** — at module scope, when not `building`, resolve
   `METRICS_PORT` from `$env/dynamic/private` and start the metrics server
   (dev and prod both). The existing `handle` hook is instrumented: time
   `resolve(event)`, label with `event.request.method`,
   `event.route.id ?? '(unmatched)'` (route template keeps label cardinality
   bounded), and the response status; a thrown error records status 500 and
   rethrows.

## Configuration

- `METRICS_PORT` added to `env-schema.json` (`type: number`, `min: 1`,
  `max: 65535`, not required) and documented in `.env.example`.
- Read via `$env/dynamic/private` so it is a runtime (not build-time) setting.

## PromQL the dashboard needs

- p50/p90/p99: `histogram_quantile(0.99, sum by (le) (rate(http_request_duration_seconds_bucket[5m])))`
- Requests per minute: `sum(rate(http_requests_total[1m])) * 60`
- Memory used / capacity: `process_resident_memory_bytes` /
  `system_memory_total_bytes`
- Process CPU: `rate(process_cpu_seconds_total[1m])`

## Error handling

- Invalid `METRICS_PORT` → warn + default (matches Twilio).
- Metrics server listen failure → log error, app keeps serving.
- Instrumentation failures must never break request handling.

## Testing

Vitest unit tests (no network binding required except one loopback test):

- `resolveMetricsPort`: empty, valid, non-numeric, out-of-range.
- Registry: recording requests shows up in rendered exposition text; default
  and system metrics present; content type correct.
- Metrics server: starts on an ephemeral port, `GET /metrics` returns 200 with
  the Prometheus content type, other paths 404, double-start is a no-op.
- `handle` instrumentation: records method/route/status; error path records
  500 and rethrows.
