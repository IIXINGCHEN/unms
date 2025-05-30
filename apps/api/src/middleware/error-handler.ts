import type { ErrorHandler } from 'hono';

import { ApiError, createErrorResponse } from '../../../../packages/shared/dist/index.js';

export const errorHandler: ErrorHandler = (err, c) => {
  console.error('API Error:', err);

  // 如果是自定义API错误
  if (err instanceof ApiError) {
    return c.json(createErrorResponse(err.message, err.code, err.data), {
      status: err.code as any,
    });
  }

  // 如果是Zod验证错误
  if (err.name === 'ZodError') {
    const zodError = err as any;
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
