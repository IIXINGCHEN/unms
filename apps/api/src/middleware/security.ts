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
    
    // 内容安全策略 (CSP)
    const csp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com https://cdnjs.cloudflare.com",
      "img-src 'self' data: https:",
      "connect-src 'self'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'"
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
 * 专门用于 API 路由的安全配置
 */
export const apiSecurity = (): MiddlewareHandler => {
  return async (c, next) => {
    // API 特定的安全头部
    c.header('X-API-Version', '2.0.0');
    c.header('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    c.header('Pragma', 'no-cache');
    
    await next();
  };
};
