// ===========================================
// UNM-Server V2 Netlify Functions 部署入口文件
// ===========================================

const { Hono } = require('hono');
const { handle } = require('hono/netlify');
const { cors } = require('hono/cors');
const { logger } = require('hono/logger');
const { prettyJSON } = require('hono/pretty-json');

// 创建 Hono 应用
const app = new Hono();

// 简化的环境配置
const nodeEnv = process.env.NODE_ENV || 'production';
const isProduction = nodeEnv === 'production';
const allowedDomain = process.env.ALLOWED_DOMAIN || '*';

// 基础中间件
app.use('*', logger());

// CORS 配置 - 生产环境使用严格配置
let corsOrigin = '*';
if (isProduction && allowedDomain !== '*') {
  corsOrigin = allowedDomain.includes(',')
    ? allowedDomain.split(',').map(domain => domain.trim())
    : allowedDomain;
}

app.use('*', cors({
  origin: corsOrigin,
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: corsOrigin !== '*',
}));

// JSON 美化 (仅开发环境)
if (!isProduction) {
  app.use('*', prettyJSON());
}

// 简化的响应创建函数
function createSuccessResponse(data, message = '请求成功', code = 200) {
  return {
    code,
    message,
    data,
    timestamp: Date.now(),
    requestId: `req_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 11)}`,
  };
}

function createErrorResponse(message, code = 500, data = null) {
  return {
    code,
    message,
    data,
    timestamp: Date.now(),
    requestId: `req_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 11)}`,
  };
}

// 健康检查
app.get('/health', async (c) => {
  try {
    const healthData = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: '2.0.0',
      environment: nodeEnv,
      platform: 'netlify',
      memory: process.memoryUsage(),
    };

    return c.json(createSuccessResponse(healthData, '服务健康'));
  } catch (error) {
    console.error('健康检查失败:', error);
    return c.json(createErrorResponse('健康检查失败', 500), { status: 500 });
  }
});

// API 信息
app.get('/api', async (c) => {
  const apiInfo = {
    name: 'UNM-Server V2',
    version: '2.0.0',
    description: '音乐聚合API服务',
    platform: 'netlify',
    environment: nodeEnv,
    endpoints: {
      health: '/health',
      api: '/api',
      music: '/api/music/*',
    },
    status: 'running',
  };

  return c.json(createSuccessResponse(apiInfo, 'API服务运行正常'));
});

// 音乐搜索 API (简化版)
app.get('/api/music/search', async (c) => {
  try {
    const { name, source = 'netease' } = c.req.query();

    if (!name) {
      return c.json(createErrorResponse('缺少搜索关键词', 400), { status: 400 });
    }

    // 简化的响应，实际项目中这里会调用真实的音乐API
    const searchResult = {
      keyword: name,
      source: source,
      results: [
        {
          id: '123456',
          name: `搜索结果: ${name}`,
          artist: '示例艺术家',
          album: '示例专辑',
          duration: 240,
          url: null, // 在实际实现中会有真实的URL
        }
      ],
      total: 1,
      page: 1,
      limit: 20,
    };

    return c.json(createSuccessResponse(searchResult, '搜索成功'));
  } catch (error) {
    console.error('音乐搜索失败:', error);
    return c.json(createErrorResponse('搜索失败', 500), { status: 500 });
  }
});

// 根路径重定向到 API 信息
app.get('/', (c) => {
  return c.redirect('/api');
});

// 404 处理
app.notFound((c) => {
  return c.json(createErrorResponse('API端点不存在', 404), { status: 404 });
});

// 错误处理
app.onError((error, c) => {
  console.error('应用错误:', error);
  return c.json(createErrorResponse('服务器内部错误', 500), { status: 500 });
});

// 导出 Netlify Functions 处理函数
exports.handler = async (event, context) => {
  try {
    return await handle(app)(event, context);
  } catch (error) {
    console.error('Netlify Function Error:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        code: 500,
        message: '服务器内部错误',
        error: error.message,
        timestamp: Date.now(),
      }),
    };
  }
};
