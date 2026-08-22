import { createHash } from 'node:crypto';
import type { RequestHandler } from 'express';
import { env } from '../config/env.js';

declare module 'express-serve-static-core' {
  interface Request {
    sessionKeyHash: string | null;
  }
}

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function hashSessionKey(sessionKey: string, salt = env.SESSION_KEY_SALT): string {
  return createHash('sha256').update(`${salt}:${sessionKey}`, 'utf8').digest('hex');
}

export const sessionKeyMiddleware: RequestHandler = (request, _response, next) => {
  const header = request.header('X-Session-Key');
  if (!header) {
    request.sessionKeyHash = null;
    next();
    return;
  }
  if (!UUID_V4.test(header)) {
    request.sessionKeyHash = null;
    next();
    return;
  }
  request.sessionKeyHash = hashSessionKey(header);
  next();
};