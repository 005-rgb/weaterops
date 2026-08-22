import type { RequestHandler } from 'express';

import { getHealth } from './system.service.js';

export const health: RequestHandler = async (_request, response, next) => {
  try {
    const result = await getHealth();
    response.status(result.status === 'ok' ? 200 : 503).json(result);
  } catch (error) {
    next(error);
  }
};