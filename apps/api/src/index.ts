import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { prettyJSON } from 'hono/pretty-json';
import { secureHeaders } from 'hono/secure-headers';
import { serve } from '@hono/node-server';

import {
  loadAllConfigs,
  validateEnvironment,
  validateProductionRequirements,
  checkConfigCompatibility
} from '@unm/config';
import {
  createErrorResponse,
  createSuccessResponse,
  CacheFactory,
  CacheManager,
  logger as appLogger,
  sanitizeLog
} from '@unm/shared';

import { errorHandler } from './middleware/error-handler.js';
import { rateLimiter } from './middleware/rate-limiter.js';
import { requestId } from './middleware/request-id.js';
import { cacheStatsMiddleware } from './middleware/cache.js';
import { securityHeaders, apiSecurity } from './middleware/security.js';
import { redisRateLimiter, RateLimitPresets } from './middleware/redis-rate-limiter.js';
import { apiRoutes } from './routes/index.js';
import { HealthChecker } from './utils/health-check.js';

// 验证环境配置
validateEnvironment();
validateProductionRequirements();
checkConfigCompatibility();

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
app.use('*', securityHeaders());
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

// 速率限制 - 使用 Redis 分布式限制器
app.use('*', redisRateLimiter(RateLimitPresets.global));

// API路由 - 添加API特定的安全和速率限制
app.use('/api/*', apiSecurity());
app.use('/api/*', redisRateLimiter(RateLimitPresets.api));
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

// 健康检查 - 快速检查（用于负载均衡器）
app.get('/health', async (c) => {
  const healthChecker = HealthChecker.getInstance();
  const quickStatus = await healthChecker.quickCheck();

  if (quickStatus.status === 'ok') {
    return c.json(createSuccessResponse(quickStatus, '服务健康'));
  } else {
    return c.json(createErrorResponse('服务不健康', 503, quickStatus), { status: 503 });
  }
});

// 详细健康检查
app.get('/health/detailed', async (c) => {
  const healthChecker = HealthChecker.getInstance();
  const healthStatus = await healthChecker.checkHealth();

  const statusCode = healthStatus.status === 'healthy' ? 200 :
    healthStatus.status === 'degraded' ? 200 : 503;

  if (statusCode === 503) {
    return c.json(createErrorResponse('服务不健康', 503, healthStatus), { status: 503 });
  }

  return c.json(createSuccessResponse(healthStatus, '详细健康状态'));
});

// 404处理
app.notFound((c) => {
  return c.json(createErrorResponse('请求的资源未找到', 404), 404);
});

// 错误处理
app.onError(errorHandler);

// 启动服务器
const port = appConfig.port;

appLogger.info('UNM-Server V2 API 启动中...', {
  port,
  environment: appConfig.nodeEnv,
  cors: sanitizeLog(appConfig.allowedDomain),
  cacheEnabled: cacheConfig.enabled,
  version: '2.0.0'
});

serve({
  fetch: app.fetch,
  port,
});

appLogger.info('服务器启动成功', {
  port,
  url: `http://localhost:${port}`,
  environment: appConfig.nodeEnv
});

// 优雅关闭处理
process.on('SIGTERM', async () => {
  appLogger.info('收到SIGTERM信号，开始优雅关闭...');
  try {
    await CacheManager.getInstance().close();
    appLogger.info('缓存服务已关闭');
    process.exit(0);
  } catch (error) {
    appLogger.error('关闭过程中出现错误', error);
    process.exit(1);
  }
});

process.on('SIGINT', async () => {
  appLogger.info('收到SIGINT信号，开始优雅关闭...');
  try {
    await CacheManager.getInstance().close();
    appLogger.info('缓存服务已关闭');
    process.exit(0);
  } catch (error) {
    appLogger.error('关闭过程中出现错误', error);
    process.exit(1);
  }
});

export default app;
