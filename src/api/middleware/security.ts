import type { MiddlewareHandler } from 'hono';

/**
 * 安全头部中间件
 * 添加各种安全相关的 HTTP 头部
 */
export const securityHeaders = (): MiddlewareHandler => {
  return async (c, next) => {
    // 基础安全头部
    c.header('X-Content-Type-Options', 'nosniff');
    c.header('X-Frame-Options', 'DENY');
    c.header('X-XSS-Protection', '1; mode=block');
    c.header('Referrer-Policy', 'strict-origin-when-cross-origin');
    c.header('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');

    // 内容安全策略 (CSP) - 针对纯API服务优化
    const csp = [
      "default-src 'none'",  // 默认禁止所有资源
      "connect-src 'self'",  // 仅允许同源连接
      "frame-ancestors 'none'",  // 禁止被嵌入框架
      "base-uri 'none'",  // 禁止base标签
      "form-action 'none'"  // 禁止表单提交
    ].join('; ');

    c.header('Content-Security-Policy', csp);

    // HSTS (仅在 HTTPS 环境下)
    const isHttps = c.req.header('x-forwarded-proto') === 'https' ||
      c.req.url.startsWith('https://');

    if (isHttps) {
      c.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
    }

    // 移除可能泄露服务器信息的头部
    c.header('Server', 'UNM-Server-V2');

    await next();
  };
};

/**
 * API 安全中间件
 * 专门用于纯后端API服务的安全配置
 */
export const apiSecurity = (): MiddlewareHandler => {
  return async (c, next) => {
    // API 特定的安全头部
    c.header('X-API-Version', '2.0.0');
    c.header('X-Service-Type', 'backend-api');
    c.header('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    c.header('Pragma', 'no-cache');
    c.header('Expires', '0');

    // 明确标识这是纯API服务
    c.header('X-Powered-By', 'UNM-Server-V2-Backend-API');

    await next();
  };
};
