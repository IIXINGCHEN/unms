// Netlify Functions 适配器
// 将 Koa 应用包装为 Netlify Function

const serverless = require('serverless-http');
const path = require('path');

// 设置环境变量，确保应用知道它在 Netlify 环境中运行
process.env.NETLIFY_FUNCTIONS = 'true';

// 动态导入主应用
let app;

try {
  // 导入主应用的 Koa 实例
  // 需要修改 index.js 以支持导出应用实例
  const appModule = require('../../index-netlify.js');
  app = appModule.app || appModule;
} catch (error) {
  console.error('Failed to load main application:', error);
  
  // 如果主应用加载失败，创建一个简单的错误响应
  const Koa = require('koa');
  app = new Koa();
  
  app.use(async (ctx) => {
    ctx.status = 500;
    ctx.body = {
      code: 500,
      message: '服务器内部错误：应用加载失败',
      data: null,
      error: error.message
    };
  });
}

// 创建 serverless 处理器
const handler = serverless(app, {
  // 配置选项
  binary: false, // 不处理二进制内容
  request: (request, event, context) => {
    // 在这里可以修改请求对象
    // 添加 Netlify 特定的上下文信息
    request.netlify = {
      event,
      context
    };
    return request;
  },
  response: (response, event, context) => {
    // 在这里可以修改响应对象
    return response;
  }
});

// 导出 Netlify Function 处理器
exports.handler = async (event, context) => {
  try {
    // 设置 Netlify 特定的环境信息
    process.env.NETLIFY_CONTEXT = context;
    
    // 调用 serverless 处理器
    const result = await handler(event, context);
    
    // 确保响应格式正确
    return {
      statusCode: result.statusCode || 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': process.env.ALLOWED_DOMAIN || '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
        ...result.headers
      },
      body: result.body
    };
  } catch (error) {
    console.error('Netlify Function error:', error);
    
    // 返回错误响应
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': process.env.ALLOWED_DOMAIN || '*'
      },
      body: JSON.stringify({
        code: 500,
        message: '服务器内部错误',
        data: null,
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      })
    };
  }
};
