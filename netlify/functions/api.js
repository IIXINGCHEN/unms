// ===========================================
// UNM-Server V2 Netlify Functions 部署入口文件 (原生版本)
// ===========================================

// 环境配置
const nodeEnv = process.env.NODE_ENV || 'production';
const isProduction = nodeEnv === 'production';
const allowedDomain = process.env.ALLOWED_DOMAIN || '*';

// CORS 头部配置
function getCorsHeaders() {
  return {
    'Access-Control-Allow-Origin': allowedDomain,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
    'Content-Type': 'application/json',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
  };
}

// 响应创建函数
function createResponse(statusCode, data, customHeaders = {}) {
  return {
    statusCode,
    headers: { ...getCorsHeaders(), ...customHeaders },
    body: data ? JSON.stringify(data) : '',
  };
}

function createSuccessResponse(data, message = '请求成功', code = 200) {
  return createResponse(code, {
    code,
    message,
    data,
    timestamp: Date.now(),
    requestId: `req_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 11)}`,
  });
}

function createErrorResponse(message, code = 500, data = null) {
  return createResponse(code, {
    code,
    message,
    data,
    timestamp: Date.now(),
    requestId: `req_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 11)}`,
  });
}

// 路由处理函数
function handleRequest(event) {
  const { path, httpMethod, queryStringParameters } = event;
  const method = httpMethod.toUpperCase();

  console.log(`${method} ${path}`);

  // 处理 OPTIONS 请求 (CORS 预检)
  if (method === 'OPTIONS') {
    return createResponse(200, { message: 'CORS preflight' });
  }

  // 路由匹配
  if (path === '/health' && method === 'GET') {
    return handleHealth();
  }

  if (path === '/api' && method === 'GET') {
    return handleApiInfo();
  }

  if (path === '/api/music/search' && method === 'GET') {
    return handleMusicSearch(queryStringParameters);
  }

  if (path === '/' && method === 'GET') {
    return createResponse(302, null, {
      ...getCorsHeaders(),
      'Location': '/api',
    });
  }

  // 404 处理
  return createErrorResponse('API端点不存在', 404);
}

// 健康检查处理
function handleHealth() {
  try {
    const healthData = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: '2.0.0',
      environment: nodeEnv,
      platform: 'netlify',
      memory: process.memoryUsage(),
    };

    return createSuccessResponse(healthData, '服务健康');
  } catch (error) {
    console.error('健康检查失败:', error);
    return createErrorResponse('健康检查失败', 500);
  }
}

// API 信息处理
function handleApiInfo() {
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

  return createSuccessResponse(apiInfo, 'API服务运行正常');
}

// 音乐搜索处理
function handleMusicSearch(queryParams) {
  try {
    const name = queryParams?.name;
    const source = queryParams?.source || 'netease';

    if (!name) {
      return createErrorResponse('缺少搜索关键词', 400);
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

    return createSuccessResponse(searchResult, '搜索成功');
  } catch (error) {
    console.error('音乐搜索失败:', error);
    return createErrorResponse('搜索失败', 500);
  }
}

// 导出 Netlify Functions 处理函数
exports.handler = async (event, context) => {
  try {
    console.log('Netlify Function called:', event.httpMethod, event.path);
    return handleRequest(event);
  } catch (error) {
    console.error('Netlify Function Error:', error);
    return createErrorResponse('服务器内部错误: ' + error.message, 500);
  }
};
