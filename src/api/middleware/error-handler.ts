import type { ErrorHandler } from 'hono';

import { ApiError, createErrorResponse, logger } from '../../shared/index.js';

export const errorHandler: ErrorHandler = (err, c) => {
  const requestId = c.get('requestId');
  const ip = c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || 'unknown';
  const userAgent = c.req.header('user-agent');
  const method = c.req.method;
  const url = c.req.url;

  // 记录错误日志
  logger.error('API错误', err, {
    requestId,
    ip,
    userAgent,
    method,
    endpoint: url,
    errorType: err.constructor.name
  });

  // 如果是自定义API错误
  if (err instanceof ApiError) {
    return c.json(createErrorResponse(err.message, err.code, err.data), {
      status: err.code as any,
    });
  }

  // 如果是Zod验证错误
  if (err.name === 'ZodError') {
    const zodError = err as any;
    logger.warn('参数验证失败', {
      requestId,
      ip,
      endpoint: url,
      validationErrors: zodError.issues || zodError.errors
    });

    return c.json(
      createErrorResponse('请求参数验证失败', 400, {
        validation_errors: zodError.issues || zodError.errors,
      }),
      { status: 400 }
    );
  }

  // 其他错误
  const isDev = process.env.NODE_ENV !== 'production';
  const message = isDev ? err.message : '服务器内部错误';
  const data = isDev ? { stack: err.stack } : null;

  return c.json(createErrorResponse(message, 500, data), { status: 500 });
};
