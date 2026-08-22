import type { RequestHandler } from 'express';

export const requestLogger: RequestHandler = (request, response, next) => {
  const startedAt = performance.now();
  response.on('finish', () => {
    console.log(
      JSON.stringify({
        method: request.method,
        path: request.originalUrl,
        status: response.statusCode,
        duration_ms: Math.round(performance.now() - startedAt),
      }),
    );
  });
  next();
};