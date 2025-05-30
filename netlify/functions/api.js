// Netlify Functions 适配器
// 将 Koa 应用包装为 Netlify Function

const serverless = require('serverless-http');

// 设置环境变量，确保应用知道它在 Netlify 环境中运行
process.env.NETLIFY_FUNCTIONS = 'true';

// 导入主应用的 Koa 实例
const { app } = require('../../index-netlify.js');

// 创建 serverless 处理器
const handler = serverless(app, {
  binary: false // 不处理二进制内容
});

// 导出 Netlify Function 处理器
exports.handler = handler;
