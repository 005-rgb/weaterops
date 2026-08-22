import { context, propagation, trace, type Span, type SpanOptions } from '@opentelemetry/api';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { ConsoleSpanExporter } from '@opentelemetry/sdk-trace-base';

const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT?.trim();
const exporter = endpoint
  ? new OTLPTraceExporter({ url: endpoint })
  : new ConsoleSpanExporter();

export const tracingSdk = new NodeSDK({
  traceExporter: exporter,
  instrumentations: [getNodeAutoInstrumentations()],
});

// This module is imported before Express in the server/app entry points.
tracingSdk.start();

export const weatherOpsTracer = trace.getTracer('weatherops', '1.0.0');

export function currentTraceId(): string | null {
  const span = trace.getActiveSpan();
  const traceId = span?.spanContext().traceId;
  return traceId && traceId !== '00000000000000000000000000000000' ? traceId : null;
}

export function traceparentFor(span: Span | undefined = trace.getActiveSpan()): string | null {
  if (!span) return null;
  const spanContext = span.spanContext();
  if (!spanContext.traceId || spanContext.traceId === '00000000000000000000000000000000') return null;
  return `00-${spanContext.traceId}-${spanContext.spanId}-01`;
}

export function extractTraceContext(headers: Record<string, string | string[] | undefined>) {
  return propagation.extract(context.active(), headers, {
    get(carrier, key) {
      const value = carrier[key];
      return Array.isArray(value) ? value[0] : value;
    },
    keys(carrier) {
      return Object.keys(carrier);
    },
  });
}

export async function withSpan<T>(
  name: string,
  options: SpanOptions,
  callback: (span: Span) => Promise<T> | T,
): Promise<T> {
  return weatherOpsTracer.startActiveSpan(name, options, callback);
}