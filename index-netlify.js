// Netlify Functions 专用应用入口
// 基于 index.js，但移除了服务器启动逻辑

require("dotenv").config();
const Koa = require("koa");
const bodyParser = require("koa-bodyparser");
const cors = require("koa2-cors");
const serve = require("koa-static");
const views = require("koa-views");
const ratelimit = require("koa-ratelimit");
const helmet = require("koa-helmet");

// 安全加载 UNM 模块，在 Netlify 环境中可能不可用
let unmAvailable = false;
let unmModule = null;
try {
  unmModule = require("@unblockneteasemusic/server");
  unmAvailable = true;
  console.log("UNM module loaded successfully");
} catch (error) {
  console.warn("UNM module failed to load in Netlify environment:", error.message);
  unmAvailable = false;
}

// 将 UNM 可用性状态传递给路由
process.env.UNM_AVAILABLE = unmAvailable.toString();

const router = require("./routes");

// 导入配置验证模块
const { validateConfig } = require("./config/validation");

// 验证配置
const config = validateConfig();

// 使用验证后的配置
const domain = config.allowedDomain;

// 创建 Koa 应用实例
const app = new Koa();

// 配置请求频率限制
// 在 Netlify Functions 中，使用内存存储
const db = new Map();

// 全局请求限制：每分钟 60 次请求
app.use(ratelimit({
  driver: 'memory',
  db: db,
  duration: 60 * 1000, // 1 分钟
  max: 60, // 最大请求数
  errorMessage: {
    code: 429,
    message: '请求过于频繁，请稍后再试',
    data: null
  },
  id: (ctx) => ctx.ip,
  headers: {
    remaining: 'Rate-Limit-Remaining',
    reset: 'Rate-Limit-Reset',
    total: 'Rate-Limit-Total'
  },
  disableHeader: false,
}));

// 为敏感 API 端点设置更严格的限制
app.use(async (ctx, next) => {
  // 敏感 API 路径列表
  const sensitivePaths = ['/match', '/url', '/search'];
  const currentPath = ctx.path;

  // 检查当前路径是否是敏感 API
  if (sensitivePaths.some(path => currentPath.startsWith(path))) {
    // 使用更严格的限制：每分钟 30 次请求
    const sensitiveDb = new Map();
    await ratelimit({
      driver: 'memory',
      db: sensitiveDb,
      duration: 60 * 1000, // 1 分钟
      max: 30, // 最大请求数
      errorMessage: {
        code: 429,
        message: '敏感 API 请求过于频繁，请稍后再试',
        data: null
      },
      id: (ctx) => ctx.ip,
    })(ctx, next);
  } else {
    await next();
  }
});

// 添加安全头信息
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      // 允许内联脚本和从 self 加载脚本
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      // 允许内联事件处理器（如 onclick 属性）
      scriptSrcAttr: ["'unsafe-inline'"],
      // 允许从 fonts.googleapis.com 和 cdnjs.cloudflare.com 加载样式表
      styleSrc: ["'self'", "'unsafe-inline'", "fonts.googleapis.com", "cdnjs.cloudflare.com"],
      imgSrc: ["'self'", "data:"],
      connectSrc: ["'self'"],
      // 允许从 fonts.gstatic.com、cdnjs.cloudflare.com 和本地加载字体
      fontSrc: ["'self'", "fonts.gstatic.com", "cdnjs.cloudflare.com"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    }
  }
}));

// 解析请求体
app.use(bodyParser());

// 静态文件目录（在 Netlify 中，静态文件由 CDN 直接提供）
// 但保留这些中间件以防某些路由需要
app.use(serve(__dirname + "/public"));
app.use(views(__dirname + "/public"));

// 跨域设置 - 增强安全性
app.use(
  cors({
    origin: domain, // 使用配置中的域名或默认值
    allowMethods: ['GET'], // 仅允许 GET 方法
    allowHeaders: ['Content-Type', 'Authorization'], // 允许的请求头
    exposeHeaders: ['Content-Length', 'Date', 'X-Request-Id'], // 暴露的响应头
    maxAge: 86400, // 预检请求结果缓存时间（秒），24小时
    credentials: true, // 允许发送 Cookie
  })
);

// 域名检查中间件 - 支持多个域名
app.use(async (ctx, next) => {
  // 如果允许所有域名访问
  if (domain === "*") {
    // 在生产环境中记录警告
    if (config.isProduction) {
      console.warn('警告: 在生产环境中使用 "*" 作为允许的域名可能存在安全风险');
    }
    await next();
  } else {
    // 获取请求的来源
    const origin = ctx.headers.origin;
    const referer = ctx.headers.referer;
    let allowed = false;

    // 如果 domain 是数组（多个域名）
    if (Array.isArray(domain)) {
      // 检查 origin 是否匹配任一允许的域名
      if (origin) {
        allowed = domain.some(allowedDomain =>
          origin.endsWith(allowedDomain) || origin === allowedDomain
        );
      }
      // 如果 origin 不匹配，检查 referer
      if (!allowed && referer) {
        allowed = domain.some(allowedDomain =>
          referer.includes(allowedDomain)
        );
      }
    } else {
      // 单个域名的情况
      if (origin && (origin.endsWith(domain) || origin === domain)) {
        allowed = true;
      } else if (referer && referer.includes(domain)) {
        allowed = true;
      }
    }

    if (allowed) {
      await next();
    } else {
      // 返回标准格式的错误响应
      ctx.status = 403;
      ctx.body = {
        code: 403,
        message: "请通过正确的域名访问",
        data: null
      };
    }
  }
});

// 使用路由中间件
app.use(router.routes());
app.use(router.allowedMethods());

// 导出应用实例供 Netlify Functions 使用
module.exports = { app, config };
