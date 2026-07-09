import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions';

// OTEL_EXPORTER_OTLP_ENDPOINT (injected by the operator) is the bare
// collector origin, e.g. "http://alloy.observability.svc:4318" — the OTLP
// HTTP spec requires the signal-specific path appended (/v1/traces), which
// the exporter's `url` option does NOT add automatically once you pass one
// explicitly. Passing the endpoint straight through silently 404s every
// export.
const otlpEndpoint = (process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? 'http://alloy.observability.svc:4318').replace(/\/$/, '');

const sdk = new NodeSDK({
  resource: resourceFromAttributes({
  [ATTR_SERVICE_NAME]:
    process.env.OTEL_SERVICE_NAME ?? 'shop-api',

  shop:
    process.env.OTEL_RESOURCE_ATTRIBUTES?.replace(
      'shop=',
      '',
    ) ?? 'unknown',
}),

  traceExporter: new OTLPTraceExporter({
    url: `${otlpEndpoint}/v1/traces`,
  }),

  instrumentations: [
    getNodeAutoInstrumentations(),
  ],
});


try {
  sdk.start();

  console.log('OpenTelemetry started');

} catch (error) {
  console.error(
    'OpenTelemetry initialization failed',
    error,
  );
}