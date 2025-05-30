import type { MiddlewareHandler } from 'hono';

import { createErrorResponse } from '../../shared/index.js';

interface RateLimitConfig {
  windowMs: number; // 时间窗口（毫秒）
  maxRequests: number; // 最大请求数
  message?: string; // 错误消息
}

// 内存存储（生产环境应使用Redis）
const requestCounts = new Map<string, { count: number; resetTime: number }>();

export const rateLimiter = (configs: any): MiddlewareHandler => {
  const globalConfig: RateLimitConfig = {
    windowMs: 60 * 1000, // 1分钟
    maxRequests: 60, // 60次请求
    message: '请求过于频繁，请稍后再试',
  };

  const sensitiveConfig: RateLimitConfig = {
    windowMs: 60 * 1000, // 1分钟
    maxRequests: 30, // 30次请求
    message: '敏感API请求过于频繁，请稍后再试',
  };

  return async (c, next) => {
    const ip = c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || 'unknown';
    const path = c.req.path;

    // 敏感路径
    const sensitivePaths = ['/api/match', '/api/url', '/api/search'];
    const isSensitive = sensitivePaths.some(sensitivePath =>
      path.startsWith(sensitivePath)
    );

    const config = isSensitive ? sensitiveConfig : globalConfig;
    const key = `${ip}:${isSensitive ? 'sensitive' : 'global'}`;
    const now = Date.now();

    // 获取或创建请求记录
    let record = requestCounts.get(key);

    if (!record || now > record.resetTime) {
      // 创建新记录或重置过期记录
      record = {
        count: 1,
        resetTime: now + config.windowMs,
      };
      requestCounts.set(key, record);
    } else {
      // 增加请求计数
      record.count++;
    }

    // 检查是否超过限制
    if (record.count > config.maxRequests) {
      const resetIn = Math.ceil((record.resetTime - now) / 1000);

      c.header('X-RateLimit-Limit', config.maxRequests.toString());
      c.header('X-RateLimit-Remaining', '0');
      c.header('X-RateLimit-Reset', resetIn.toString());

      return c.json(
        createErrorResponse(config.message || '请求过于频繁', 429),
        { status: 429 }
      );
    }

    // 设置速率限制头
    const remaining = config.maxRequests - record.count;
    const resetIn = Math.ceil((record.resetTime - now) / 1000);

    c.header('X-RateLimit-Limit', config.maxRequests.toString());
    c.header('X-RateLimit-Remaining', remaining.toString());
    c.header('X-RateLimit-Reset', resetIn.toString());

    return await next();
  };
};

// 清理过期记录的定时任务
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of requestCounts.entries()) {
    if (now > record.resetTime) {
      requestCounts.delete(key);
    }
  }
}, 60 * 1000); // 每分钟清理一次
