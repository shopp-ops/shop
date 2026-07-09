import { Counter, Histogram } from 'prom-client';


export const httpRequestDuration = new Histogram({
    name:'http_request_duration_seconds',
    help:'HTTP request duration',
    labelNames:[ 'method', 'route', 'status'],
    buckets:[ 0.1, 0.3, 1, 2, 5]

});

export const httpRequestsTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total HTTP requests',
  labelNames: [
    'method',
    'route',
    'status',
  ],
});