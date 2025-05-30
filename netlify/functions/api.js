// Netlify Functions 适配入口文件
import { Hono } from 'hono';
import { handle } from 'hono/netlify';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { prettyJSON } from 'hono/pretty-json';
import { secureHeaders } from 'hono/secure-headers';

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
import { securityMiddleware } from '../../dist/api/middleware/security.js';

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

// 初始化缓存 (Netlify Functions 中使用内存缓存)
if (cacheConfig.enabled) {
  try {
    const cacheManager = CacheManager.getInstance();
    // Netlify Functions 环境下强制使用内存缓存
    const netlifyConfig = { ...cacheConfig, type: 'memory' };
    await cacheManager.initialize(netlifyConfig);
    appLogger.info('缓存系统初始化成功', { type: 'memory' });
  } catch (error) {
    appLogger.warn('缓存初始化失败，将禁用缓存功能', error);
  }
}

// 基础中间件
app.use('*', logger());
app.use('*', requestId);
app.use('*', secureHeaders());

// CORS 配置
app.use('*', cors({
  origin: appConfig.allowedDomain,
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));

// 安全中间件
app.use('*', securityMiddleware);

// 速率限制 (Netlify Functions 中使用内存限制)
app.use('/api/*', rateLimiter);

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
