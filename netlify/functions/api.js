// ===========================================
// UNM-Server V2 Netlify Functions 部署入口文件
// ===========================================

import { Hono } from 'hono';
import { handle } from 'hono/netlify';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { prettyJSON } from 'hono/pretty-json';

// 导入配置和工具
import {
  loadAllConfigs,
  validateEnvironment,
  validateProductionRequirements,
  checkConfigCompatibility
} from '../../dist/config/index.js';
import {
  createErrorResponse,
  createSuccessResponse,
  CacheFactory,
  CacheManager,
  logger as appLogger,
  sanitizeLog
} from '../../dist/shared/index.js';

// 导入路由
import { apiRoutes } from '../../dist/api/routes/index.js';
import { musicRoutes } from '../../dist/api/routes/music.js';
import { unmRoutes } from '../../dist/api/routes/unm.js';

// 导入中间件
import { errorHandler } from '../../dist/api/middleware/error-handler.js';
import { rateLimiter } from '../../dist/api/middleware/rate-limiter.js';
import { requestId } from '../../dist/api/middleware/request-id.js';
import { securityHeaders, apiSecurity } from '../../dist/api/middleware/security.js';
import { cacheStatsMiddleware } from '../../dist/api/middleware/cache.js';

// 创建 Hono 应用
const app = new Hono().basePath('/');

// 验证环境配置
try {
  validateEnvironment();
  validateProductionRequirements();
  checkConfigCompatibility();
} catch (error) {
  console.error('环境配置验证失败:', error);
}

// 加载配置
const configs = loadAllConfigs();
const { app: appConfig, cache: cacheConfig } = configs;

// 初始化缓存系统 (Netlify Functions 环境使用内存缓存)
const cacheService = CacheFactory.createCache(
  undefined, // Netlify Functions 不使用 Redis
  { stdTTL: cacheConfig.defaultTTL }
);
CacheManager.getInstance().initialize(cacheService);

// 基础中间件
app.use('*', logger());
app.use('*', requestId());
app.use('*', securityHeaders());
app.use('*', cacheStatsMiddleware());

// CORS 配置 - 生产环境使用严格配置
const corsOrigin = appConfig.isProduction && appConfig.allowedDomain !== '*'
  ? (Array.isArray(appConfig.allowedDomain) ? appConfig.allowedDomain : [appConfig.allowedDomain])
  : '*';

app.use('*', cors({
  origin: corsOrigin,
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: corsOrigin !== '*',
}));

// API路由 - 添加API特定的安全配置
app.use('/api/*', apiSecurity());

// 速率限制 (Netlify Functions 中使用内存限制)
app.use('/api/*', rateLimiter(configs));

// JSON 美化 (仅开发环境)
if (!appConfig.isProduction) {
  app.use('*', prettyJSON());
}

// 健康检查
app.get('/health', async (c) => {
  try {
    const cacheManager = CacheManager.getInstance();
    const cacheStatus = await cacheManager.getStatus();

    const healthData = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '2.0.0',
      environment: appConfig.nodeEnv,
      platform: 'netlify',
      cache: cacheStatus,
      memory: process.memoryUsage(),
      cors: sanitizeLog(appConfig.allowedDomain),
    };

    return c.json(createSuccessResponse(healthData, '服务运行正常'));
  } catch (error) {
    appLogger.error('健康检查失败', error);
    return c.json(createErrorResponse('健康检查失败', 500), { status: 500 });
  }
});

// API 路由
app.route('/api', apiRoutes);
app.route('/api/music', musicRoutes);
app.route('/api/unm', unmRoutes);

// 根路径重定向到 API 信息
app.get('/', (c) => {
  return c.redirect('/api');
});

// 404 处理
app.notFound((c) => {
  return c.json(createErrorResponse('API端点不存在', 404), { status: 404 });
});

// 错误处理
app.onError(errorHandler);

// 导出 Netlify Functions 处理函数
export const handler = handle(app);
