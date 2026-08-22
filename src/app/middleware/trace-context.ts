import type { RequestHandler } from 'express';
import { context, trace } from '@opentelemetry/api';
import { extractTraceContext, traceparentFor, weatherOpsTracer } from '../../infrastructure/tracing/setup.js';

declare module 'express-serve-static-core' {
  interface Request {
    traceId: string;
  }
}

export const traceContextMiddleware: RequestHandler = (request, response, next) => {
  const extracted = extractTraceContext(request.headers);
  const span = weatherOpsTracer.startSpan('http.request', undefined, extracted);
  const spanContext = span.spanContext();
  request.traceId = spanContext.traceId;
  response.setHeader('traceparent', traceparentFor(span) ?? '');
  response.on('finish', () => {
    span.setAttribute('http.request.method', request.method);
    span.setAttribute('http.response.status_code', response.statusCode);
    span.end();
  });
  context.with(trace.setSpan(extracted, span), next);
};