import type { MiddlewareHandler } from 'hono';
import { CacheManager, createErrorResponse, logger } from '@unm/shared';

interface RateLimitOptions {
  windowMs: number;
  maxRequests: number;
  keyGenerator?: (c: any) => string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  message?: string;
}

/**
 * Redis 分布式速率限制中间件
 * 支持多实例部署的速率限制
 */
export const redisRateLimiter = (options: RateLimitOptions): MiddlewareHandler => {
  return async (c, next) => {
    const cacheManager = CacheManager.getInstance();
    
    // 如果缓存服务不可用，降级到允许请求通过
    if (!cacheManager.isReady()) {
      logger.warn('缓存服务不可用，速率限制降级');
      return await next();
    }

    const cache = cacheManager.getCache();
    const key = options.keyGenerator ? options.keyGenerator(c) : getDefaultKey(c);
    const now = Date.now();
    const window = Math.floor(now / options.windowMs);
    const cacheKey = `rate_limit:${key}:${window}`;

    try {
      // 获取当前窗口的请求计数
      const current = await cache.get<number>(cacheKey) || 0;
      
      // 检查是否超过限制
      if (current >= options.maxRequests) {
        const resetTime = (window + 1) * options.windowMs;
        const resetIn = Math.ceil((resetTime - now) / 1000);
        
        // 设置速率限制响应头
        c.header('X-RateLimit-Limit', options.maxRequests.toString());
        c.header('X-RateLimit-Remaining', '0');
        c.header('X-RateLimit-Reset', resetIn.toString());
        c.header('Retry-After', resetIn.toString());
        
        logger.warn('速率限制触发', {
          key,
          current,
          limit: options.maxRequests,
          resetIn,
          ip: getClientIP(c),
          userAgent: c.req.header('user-agent')
        });
        
        return c.json(
          createErrorResponse(
            options.message || '请求过于频繁，请稍后再试', 
            429,
            {
              retryAfter: resetIn,
              limit: options.maxRequests,
              windowMs: options.windowMs
            }
          ),
          { status: 429 }
        );
      }

      // 增加请求计数
      const newCount = current + 1;
      const ttl = Math.ceil(options.windowMs / 1000);
      await cache.set(cacheKey, newCount, ttl);
      
      // 设置速率限制信息头
      const remaining = Math.max(0, options.maxRequests - newCount);
      const resetTime = (window + 1) * options.windowMs;
      const resetIn = Math.ceil((resetTime - now) / 1000);
      
      c.header('X-RateLimit-Limit', options.maxRequests.toString());
      c.header('X-RateLimit-Remaining', remaining.toString());
      c.header('X-RateLimit-Reset', resetIn.toString());
      
      await next();
      
      // 根据配置决定是否跳过成功/失败请求的计数
      const statusCode = c.res.status;
      if (
        (options.skipSuccessfulRequests && statusCode < 400) ||
        (options.skipFailedRequests && statusCode >= 400)
      ) {
        // 回滚计数
        await cache.set(cacheKey, current, ttl);
      }
      
    } catch (error) {
      logger.error('速率限制器错误', error, {
        key,
        cacheKey,
        ip: getClientIP(c)
      });
      
      // 出错时允许请求通过，但记录错误
      await next();
    }
  };
};

/**
 * 获取默认的限制键
 */
function getDefaultKey(c: any): string {
  const ip = getClientIP(c);
  const userAgent = c.req.header('user-agent') || 'unknown';
  
  // 使用 IP + User-Agent 的哈希作为键，提供更好的唯一性
  const combined = `${ip}:${userAgent}`;
  return `ip:${Buffer.from(combined).toString('base64').slice(0, 16)}`;
}

/**
 * 获取客户端真实 IP
 */
function getClientIP(c: any): string {
  // 按优先级检查各种 IP 头部
  const headers = [
    'x-forwarded-for',
    'x-real-ip',
    'cf-connecting-ip',
    'x-client-ip',
    'x-cluster-client-ip'
  ];
  
  for (const header of headers) {
    const value = c.req.header(header);
    if (value) {
      // x-forwarded-for 可能包含多个 IP，取第一个
      const ip = value.split(',')[0].trim();
      if (isValidIP(ip)) {
        return ip;
      }
    }
  }
  
  return 'unknown';
}

/**
 * 验证 IP 地址格式
 */
function isValidIP(ip: string): boolean {
  // IPv4 正则
  const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
  
  // IPv6 正则（简化版）
  const ipv6Regex = /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
  
  return ipv4Regex.test(ip) || ipv6Regex.test(ip);
}

/**
 * 创建基于用户的速率限制器
 */
export const createUserRateLimiter = (options: Omit<RateLimitOptions, 'keyGenerator'>) => {
  return redisRateLimiter({
    ...options,
    keyGenerator: (c) => {
      const userId = c.get('userId') || c.req.header('x-user-id');
      if (userId) {
        return `user:${userId}`;
      }
      return getDefaultKey(c);
    }
  });
};

/**
 * 创建基于端点的速率限制器
 */
export const createEndpointRateLimiter = (options: Omit<RateLimitOptions, 'keyGenerator'>) => {
  return redisRateLimiter({
    ...options,
    keyGenerator: (c) => {
      const ip = getClientIP(c);
      const endpoint = c.req.path;
      return `endpoint:${ip}:${endpoint}`;
    }
  });
};

/**
 * 预定义的速率限制配置
 */
export const RateLimitPresets = {
  // 全局限制：每分钟 60 次请求
  global: {
    windowMs: 60 * 1000,
    maxRequests: 60,
    message: '请求过于频繁，请稍后再试'
  },
  
  // API 限制：每分钟 30 次请求
  api: {
    windowMs: 60 * 1000,
    maxRequests: 30,
    message: 'API 请求过于频繁，请稍后再试'
  },
  
  // 敏感操作：每分钟 10 次请求
  sensitive: {
    windowMs: 60 * 1000,
    maxRequests: 10,
    message: '敏感操作请求过于频繁，请稍后再试'
  },
  
  // 搜索限制：每分钟 20 次请求
  search: {
    windowMs: 60 * 1000,
    maxRequests: 20,
    message: '搜索请求过于频繁，请稍后再试'
  }
};
