import type { RequestHandler } from 'express';
import { env } from '../config/env.js';

export const internalOnly: RequestHandler = (request, response, next) => {
  const token = request.header('X-Internal-Token');
  const expected = env.INTERNAL_DEBUG_TOKEN;
  if (!expected || token !== expected) {
    response.status(403).json({ error: { code: 'INTERNAL_ONLY', message: 'Internal access required' } });
    return;
  }
  next();
};