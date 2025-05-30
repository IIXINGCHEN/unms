import type { MiddlewareHandler } from 'hono';

import { CacheManager, generateCacheKey } from '../../../../packages/shared/dist/index.js';

/**
 * 缓存中间件配置
 */
interface CacheMiddlewareOptions {
  ttl?: number; // 缓存时间（秒）
  keyGenerator?: (c: any) => string; // 自定义缓存键生成器
  skipCache?: (c: any) => boolean; // 跳过缓存条件
  onlyMethods?: string[]; // 只缓存指定方法
  varyBy?: string[]; // 根据指定头部变化缓存
}

/**
 * HTTP缓存中间件
 */
export const cacheMiddleware = (options: CacheMiddlewareOptions = {}): MiddlewareHandler => {
  const {
    ttl = 300, // 默认5分钟
    keyGenerator,
    skipCache,
    onlyMethods = ['GET'],
    varyBy = [],
  } = options;

  return async (c, next) => {
    const method = c.req.method;

    // 检查是否应该缓存此请求
    if (!onlyMethods.includes(method)) {
      return await next();
    }

    // 检查是否跳过缓存
    if (skipCache && skipCache(c)) {
      return await next();
    }

    const cacheManager = CacheManager.getInstance();
    if (!cacheManager.isReady()) {
      return await next();
    }

    const cache = cacheManager.getCache();

    // 生成缓存键
    let cacheKey: string;
    if (keyGenerator) {
      cacheKey = keyGenerator(c);
    } else {
      const url = c.req.url;
      const varyHeaders = varyBy.map(header => c.req.header(header) || '').join(':');
      cacheKey = generateCacheKey('http', url, varyHeaders);
    }

    try {
      // 尝试从缓存获取响应
      const cachedResponse = await cache.get<{
        status: number;
        headers: Record<string, string>;
        body: string;
      }>(cacheKey);

      if (cachedResponse) {
        // 设置缓存头
        c.header('X-Cache', 'HIT');
        c.header('X-Cache-Key', cacheKey);

        // 恢复响应头
        Object.entries(cachedResponse.headers).forEach(([key, value]) => {
          c.header(key, value);
        });

        return new Response(cachedResponse.body, {
          status: cachedResponse.status,
          headers: cachedResponse.headers,
        });
      }

      // 缓存未命中，执行请求
      c.header('X-Cache', 'MISS');
      c.header('X-Cache-Key', cacheKey);

      await next();

      // 缓存响应（仅对成功响应）
      if (c.res.status >= 200 && c.res.status < 300) {
        const responseBody = await c.res.text();
        const responseHeaders: Record<string, string> = {};

        // 收集响应头
        c.res.headers.forEach((value, key) => {
          responseHeaders[key] = value;
        });

        // 缓存响应
        await cache.set(cacheKey, {
          status: c.res.status,
          headers: responseHeaders,
          body: responseBody,
        }, ttl);

        // 重新创建响应
        return new Response(responseBody, {
          status: c.res.status,
          headers: c.res.headers,
        });
      }
    } catch (error) {
      console.error('缓存中间件错误:', error);
      // 缓存失败时继续正常处理
      return await next();
    }
  };
};

/**
 * API响应缓存中间件
 */
export const apiCacheMiddleware = (ttl: number = 300): MiddlewareHandler => {
  return cacheMiddleware({
    ttl,
    keyGenerator: (c) => {
      const path = c.req.path;
      const query = c.req.query();
      const queryString = new URLSearchParams(query).toString();
      return generateCacheKey('api', path, queryString);
    },
    skipCache: (c) => {
      // 跳过包含认证信息的请求
      return !!(c.req.header('authorization') || c.req.header('x-api-key'));
    },
    onlyMethods: ['GET'],
    varyBy: ['accept', 'accept-language'],
  });
};

/**
 * 音乐API专用缓存中间件
 */
export const musicCacheMiddleware = (): MiddlewareHandler => {
  return cacheMiddleware({
    ttl: 3600, // 1小时
    keyGenerator: (c) => {
      const path = c.req.path;
      const query = c.req.query();

      // 为不同类型的音乐API设置不同的缓存键
      if (path.includes('/search')) {
        return generateCacheKey('music:search', query.name || '', query.source || '');
      } else if (path.includes('/url')) {
        return generateCacheKey('music:url', query.id || '', query.br || '', query.source || '');
      } else if (path.includes('/lyric')) {
        return generateCacheKey('music:lyric', query.id || '', query.source || '');
      } else if (path.includes('/pic')) {
        return generateCacheKey('music:pic', query.id || '', query.size || '', query.source || '');
      }

      // 默认缓存键
      const queryString = new URLSearchParams(query).toString();
      return generateCacheKey('music:api', path, queryString);
    },
    onlyMethods: ['GET'],
  });
};

/**
 * 缓存清理中间件
 */
export const cacheClearMiddleware = (pattern: string): MiddlewareHandler => {
  return async (c, next) => {
    await next();

    // 只在成功的POST/PUT/DELETE请求后清理缓存
    if (c.res.status >= 200 && c.res.status < 300) {
      const method = c.req.method;
      if (['POST', 'PUT', 'DELETE'].includes(method)) {
        const cacheManager = CacheManager.getInstance();
        if (cacheManager.isReady()) {
          try {
            const cache = cacheManager.getCache();
            const keys = await cache.keys(pattern);

            // 批量删除匹配的缓存键
            await Promise.all(keys.map(key => cache.del(key)));

            console.log(`清理了 ${keys.length} 个缓存项，模式: ${pattern}`);
          } catch (error) {
            console.error('缓存清理失败:', error);
          }
        }
      }
    }
  };
};

/**
 * 缓存统计中间件
 */
export const cacheStatsMiddleware = (): MiddlewareHandler => {
  return async (c, next) => {
    const startTime = Date.now();

    await next();

    const endTime = Date.now();
    const responseTime = endTime - startTime;

    // 添加性能头
    c.header('X-Response-Time', `${responseTime}ms`);

    // 记录缓存统计
    const cacheManager = CacheManager.getInstance();
    if (cacheManager.isReady()) {
      const cache = cacheManager.getCache();
      const stats = cache.getStats();

      // 添加缓存统计头（仅在开发环境）
      if (process.env.NODE_ENV !== 'production') {
        c.header('X-Cache-Stats', JSON.stringify({
          hitRate: stats.hitRate.toFixed(2) + '%',
          totalOps: stats.totalOperations,
          hits: stats.hits,
          misses: stats.misses,
        }));
      }
    }
  };
};

/**
 * 条件缓存中间件
 */
export const conditionalCacheMiddleware = (
  condition: (c: any) => boolean,
  ttl: number = 300
): MiddlewareHandler => {
  return async (c, next) => {
    if (condition(c)) {
      return await cacheMiddleware({ ttl })(c, next);
    }
    return await next();
  };
};
