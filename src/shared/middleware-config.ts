/**
 * 统一的中间件配置管理
 * 用于在不同部署平台间共享中间件配置
 */

import type { MiddlewareHandler } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { prettyJSON } from 'hono/pretty-json';

import { requestId } from '../api/middleware/request-id.js';
import { securityHeaders, apiSecurity } from '../api/middleware/security.js';
import { redisRateLimiter, RateLimitPresets } from '../api/middleware/redis-rate-limiter.js';
import { rateLimiter } from '../api/middleware/rate-limiter.js';
import { cacheStatsMiddleware } from '../api/middleware/cache.js';
import { errorHandler } from '../api/middleware/error-handler.js';

import type { AppConfig } from './types.js';

/**
 * 部署平台类型
 */
export type DeploymentPlatform = 'vercel' | 'netlify' | 'standalone';

/**
 * 中间件配置选项
 */
export interface MiddlewareConfigOptions {
  platform: DeploymentPlatform;
  appConfig: AppConfig;
  useRedisRateLimit?: boolean;
}

/**
 * 获取 CORS 配置
 */
export function getCorsConfig(appConfig: AppConfig) {
  // 生产环境使用严格的 CORS 配置
  let corsOrigin: string | string[] = '*';

  if (appConfig.isProduction && appConfig.allowedDomain !== '*') {
    if (typeof appConfig.allowedDomain === 'string') {
      corsOrigin = appConfig.allowedDomain.split(',').map((domain: string) => domain.trim());
    } else {
      corsOrigin = appConfig.allowedDomain;
    }
  }

  return {
    origin: corsOrigin,
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    credentials: corsOrigin !== '*',
  };
}

/**
 * 获取基础中间件配置
 */
export function getBaseMiddlewares(options: MiddlewareConfigOptions): MiddlewareHandler[] {
  const { appConfig } = options;

  const middlewares: MiddlewareHandler[] = [
    // 日志记录
    logger(),
    // 请求 ID
    requestId(),
    // 安全头部
    securityHeaders(),
    // 缓存统计
    cacheStatsMiddleware(),
    // CORS 配置
    cors(getCorsConfig(appConfig)),
  ];

  // 开发环境添加 JSON 美化
  if (!appConfig.isProduction) {
    middlewares.push(prettyJSON());
  }

  return middlewares;
}

/**
 * 获取速率限制中间件
 */
export function getRateLimitMiddlewares(options: MiddlewareConfigOptions): MiddlewareHandler[] {
  const { useRedisRateLimit = true, appConfig } = options;

  const middlewares: MiddlewareHandler[] = [];

  if (useRedisRateLimit) {
    // 使用 Redis 分布式速率限制
    middlewares.push(
      redisRateLimiter(RateLimitPresets.global),
    );
  } else {
    // 使用内存速率限制（Netlify Functions 等环境）
    middlewares.push(
      rateLimiter(appConfig),
    );
  }

  return middlewares;
}

/**
 * 获取 API 特定中间件
 */
export function getApiMiddlewares(options: MiddlewareConfigOptions): MiddlewareHandler[] {
  const { useRedisRateLimit = true } = options;

  const middlewares: MiddlewareHandler[] = [
    // API 安全配置
    apiSecurity(),
  ];

  if (useRedisRateLimit) {
    // API 特定的 Redis 速率限制
    middlewares.push(
      redisRateLimiter(RateLimitPresets.api),
    );
  }

  return middlewares;
}

/**
 * 获取错误处理中间件
 */
export function getErrorHandler(): typeof errorHandler {
  return errorHandler;
}

/**
 * 为特定平台配置中间件
 */
export function configureMiddlewaresForPlatform(
  app: any,
  options: MiddlewareConfigOptions
): void {
  const { platform } = options;

  // 基础中间件（所有平台通用）
  const baseMiddlewares = getBaseMiddlewares(options);
  baseMiddlewares.forEach(middleware => {
    app.use('*', middleware);
  });

  // 速率限制中间件
  const rateLimitMiddlewares = getRateLimitMiddlewares({
    ...options,
    // Netlify Functions 使用内存速率限制
    useRedisRateLimit: platform !== 'netlify',
  });
  rateLimitMiddlewares.forEach(middleware => {
    app.use('*', middleware);
  });

  // API 特定中间件
  const apiMiddlewares = getApiMiddlewares({
    ...options,
    useRedisRateLimit: platform !== 'netlify',
  });
  apiMiddlewares.forEach(middleware => {
    app.use('/api/*', middleware);
  });

  // 错误处理（最后添加）
  app.onError(getErrorHandler());
}

/**
 * 平台特定的配置调整
 */
export function getPlatformSpecificConfig(platform: DeploymentPlatform) {
  switch (platform) {
    case 'vercel':
      return {
        useRedisRateLimit: true,
        enableCaching: true,
        logLevel: 'info',
      };

    case 'netlify':
      return {
        useRedisRateLimit: false, // Netlify Functions 使用内存限制
        enableCaching: true,
        logLevel: 'info',
      };

    case 'standalone':
      return {
        useRedisRateLimit: true,
        enableCaching: true,
        logLevel: 'debug',
      };

    default:
      return {
        useRedisRateLimit: true,
        enableCaching: true,
        logLevel: 'info',
      };
  }
}
