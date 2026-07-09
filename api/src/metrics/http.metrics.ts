import { Counter, Histogram } from 'prom-client';

// Buckets, metric names, and labels are kept identical to shophub's
// (api/src/observability/metrics.provider.ts) so both apps' panels share one
// dashboard query set.
export const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration',
  labelNames: ['method', 'route', 'status'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2, 5],
});

export const httpRequestsTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total HTTP requests',
  labelNames: ['method', 'route', 'status'],
});

export const httpResponseSize = new Counter({
  name: 'http_response_size_bytes',
  help: 'Response size in bytes',
  labelNames: ['route'],
});