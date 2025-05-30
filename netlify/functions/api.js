// Netlify Functions 适配器
// 将 Koa 应用包装为 Netlify Function

const serverless = require('serverless-http');

// 设置环境变量，确保应用知道它在 Netlify 环境中运行
process.env.NETLIFY_FUNCTIONS = 'true';

// 添加全局错误处理器，防止未处理的 Promise 拒绝导致函数崩溃
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // 不要退出进程，让函数继续运行
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  // 不要退出进程，让函数继续运行
});

// 安全地导入主应用的 Koa 实例
let app;
try {
  const appModule = require('../../index-netlify.js');
  app = appModule.app;
  if (!app) {
    throw new Error('App instance not found in index-netlify.js');
  }
} catch (error) {
  console.error('Failed to load main app:', error);
  // 创建一个简单的错误处理应用
  const Koa = require('koa');
  app = new Koa();
  app.use(async (ctx) => {
    ctx.status = 500;
    ctx.body = {
      code: 500,
      message: '服务暂时不可用，请稍后重试',
      data: null
    };
  });
}

// 创建 serverless 处理器，添加错误处理
const handler = serverless(app, {
  binary: false, // 不处理二进制内容
  callbackWaitsForEmptyEventLoop: false // 不等待事件循环为空
});

// 包装处理器以添加额外的错误处理
exports.handler = async (event, context) => {
  try {
    return await handler(event, context);
  } catch (error) {
    console.error('Handler error:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        code: 500,
        message: '服务器内部错误，请稍后重试',
        data: null
      })
    };
  }
};
