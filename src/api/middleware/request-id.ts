import type { MiddlewareHandler } from 'hono';

import { generateRequestId } from '../../shared/index.js';

export const requestId = (): MiddlewareHandler => {
  return async (c, next) => {
    const requestId = c.req.header('X-Request-ID') || generateRequestId();
    c.set('requestId', requestId);
    c.header('X-Request-ID', requestId);
    await next();
  };
};
