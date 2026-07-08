import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-grpc';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions';

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
    url:
      process.env.OTEL_EXPORTER_OTLP_ENDPOINT ??
      'http://alloy.observability.svc:4317',
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