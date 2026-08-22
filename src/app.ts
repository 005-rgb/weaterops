import express from 'express';

import { errorHandler } from './app/middleware/error-handler.js';
import { requestLogger } from './app/middleware/request-logger.js';
import { localeMiddleware } from './app/middleware/locale.js';
import { sessionKeyMiddleware } from './app/middleware/session-key.js';
import { apiRouter } from './app/routes/index.js';

export function createApp() {
  const app = express();
  app.use(express.json());
  app.use(requestLogger);
  app.use(localeMiddleware);
  app.use(sessionKeyMiddleware);
  app.use('/api/v1', apiRouter);
  app.use(errorHandler);
  return app;
}