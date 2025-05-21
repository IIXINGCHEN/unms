require("dotenv").config();
const Koa = require("koa");
const bodyParser = require("koa-bodyparser");
const cors = require("koa2-cors");
const serve = require("koa-static");
const views = require("koa-views");
const ratelimit = require("koa-ratelimit");
const helmet = require("koa-helmet");
const net = require("net");
const router = require("./routes");

// 导入配置验证模块
const { validateConfig } = require("./config/validation");

// 验证配置
const config = validateConfig();

// 使用验证后的配置
const domain = config.allowedDomain;
const port = config.port;

// 创建 Koa 应用实例
const app = new Koa();

// 配置请求频率限制
// 使用内存存储，在生产环境中可以考虑使用 Redis
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
// 在路由中间件之前应用，以便可以根据路径进行限制
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
      scriptSrc: ["'self'", "'unsafe-inline'"],
      // 允许从 cdnjs.cloudflare.com 和 fonts.googleapis.com 加载样式表
      styleSrc: ["'self'", "'unsafe-inline'", "cdnjs.cloudflare.com", "fonts.googleapis.com"],
      imgSrc: ["'self'", "data:"],
      connectSrc: ["'self'"],
      // 允许从 fonts.gstatic.com 加载字体
      fontSrc: ["'self'", "fonts.gstatic.com"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    }
  }
}));

// 解析请求体
app.use(bodyParser());

// 静态文件目录
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

// Restored port checking and listening logic
const startApp = (port) => {
  app.listen(port, () => {
    console.log(`成功在 ${port} 端口上运行`);
  });
};

// Restored port checking function
const checkPort = (port) => {
  return new Promise((resolve, reject) => {
    const server = net
      .createServer()
      .once("error", (err) => {
        if (err.code === "EADDRINUSE") {
          console.log(`端口 ${port} 已被占用, 正在尝试其他端口...`);
          server.close();
          resolve(false);
        } else {
          reject(err);
        }
      })
      .once("listening", () => {
        server.close();
        resolve(true);
      })
      .listen(port);
  });
};

// Restored tryStartApp function
const tryStartApp = async (port) => {
  let isPortAvailable = await checkPort(port);
  while (!isPortAvailable) {
    port++;
    isPortAvailable = await checkPort(port);
  }
  startApp(port);
};

// Restored call to start the server
tryStartApp(port);

// module.exports = app.callback(); // Removed Vercel export
