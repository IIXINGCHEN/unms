import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { prettyJSON } from 'hono/pretty-json';
import { secureHeaders } from 'hono/secure-headers';
import { serve } from '@hono/node-server';

import { loadAllConfigs } from '../../../packages/config/dist/index.js';
import {
  createErrorResponse,
  createSuccessResponse,
  CacheFactory,
  CacheManager
} from '../../../packages/shared/dist/index.js';

import { errorHandler } from './middleware/error-handler.js';
import { rateLimiter } from './middleware/rate-limiter.js';
import { requestId } from './middleware/request-id.js';
import { cacheStatsMiddleware } from './middleware/cache.js';
import { apiRoutes } from './routes/index.js';

// 加载配置
const configs = loadAllConfigs();
const { app: appConfig, cache: cacheConfig, redis: redisConfig } = configs;

// 初始化缓存系统
const cacheService = CacheFactory.createCache(
  cacheConfig.enabled ? redisConfig : undefined,
  { stdTTL: cacheConfig.defaultTTL }
);
CacheManager.getInstance().initialize(cacheService);

// 创建Hono应用
const app = new Hono();

// 全局中间件
app.use('*', logger());
app.use('*', requestId());
app.use('*', secureHeaders());
app.use('*', cacheStatsMiddleware());

// 开发环境下美化JSON输出
if (!appConfig.isProduction) {
  app.use('*', prettyJSON());
}

// CORS配置
app.use(
  '*',
  cors({
    origin: Array.isArray(appConfig.allowedDomain)
      ? appConfig.allowedDomain
      : appConfig.allowedDomain === '*'
        ? '*'
        : [appConfig.allowedDomain],
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
    exposeHeaders: ['X-Request-ID'],
    maxAge: 86400,
    credentials: true,
  })
);

// 速率限制
app.use('*', rateLimiter(configs));

// API路由
app.route('/api', apiRoutes);

// 根路径
app.get('/', (c) => {
  const welcomeData = {
    name: 'UNM-Server V2',
    version: '2.0.0',
    description: '现代化音乐API服务',
    documentation: '/api/docs',
    status: 'running',
    timestamp: new Date().toISOString(),
  };

  return c.json(createSuccessResponse(welcomeData, 'API服务运行中'));
});

// 健康检查
app.get('/health', (c) => {
  const cacheManager = CacheManager.getInstance();
  const cacheHealthy = cacheManager.isReady() ? cacheManager.getCache().isHealthy() : false;
  const cacheStats = cacheManager.isReady() ? cacheManager.getCache().getStats() : null;

  return c.json(
    createSuccessResponse(
      {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        services: {
          cache: cacheHealthy ? 'up' : 'down',
          api: 'up',
        },
        cache: cacheStats ? {
          enabled: cacheConfig.enabled,
          hitRate: cacheStats.hitRate.toFixed(2) + '%',
          totalOperations: cacheStats.totalOperations,
          hits: cacheStats.hits,
          misses: cacheStats.misses,
          errors: cacheStats.errors,
        } : null,
      },
      '服务健康'
    )
  );
});

// 404处理
app.notFound((c) => {
  return c.json(createErrorResponse('请求的资源未找到', 404), 404);
});

// 错误处理
app.onError(errorHandler);

// 启动服务器
const port = appConfig.port;

console.log(`🚀 UNM-Server V2 API 启动中...`);
console.log(`📡 端口: ${port}`);
console.log(`🌍 环境: ${appConfig.nodeEnv}`);
console.log(`🔒 CORS: ${JSON.stringify(appConfig.allowedDomain)}`);

serve({
  fetch: app.fetch,
  port,
});

console.log(`✅ 服务器已启动: http://localhost:${port}`);

// 优雅关闭处理
process.on('SIGTERM', async () => {
  console.log('🔄 收到SIGTERM信号，开始优雅关闭...');
  try {
    await CacheManager.getInstance().close();
    console.log('✅ 缓存服务已关闭');
    process.exit(0);
  } catch (error) {
    console.error('❌ 关闭过程中出现错误:', error);
    process.exit(1);
  }
});

process.on('SIGINT', async () => {
  console.log('🔄 收到SIGINT信号，开始优雅关闭...');
  try {
    await CacheManager.getInstance().close();
    console.log('✅ 缓存服务已关闭');
    process.exit(0);
  } catch (error) {
    console.error('❌ 关闭过程中出现错误:', error);
    process.exit(1);
  }
});

export default app;
