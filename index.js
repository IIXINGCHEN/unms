require("dotenv").config(); // Restored
const Koa = require("koa");
const bodyParser = require("koa-bodyparser");
const cors = require("koa2-cors");
const serve = require("koa-static");
const views = require("koa-views");

const app = new Koa();
const net = require("net"); // Restored
const router = require("./routes");

// 配置信息 - Restored
let domain = process.env.ALLOWED_DOMAIN || "*";
let port = process.env.PORT || 5678;

// 解析请求体
app.use(bodyParser());

// 静态文件目录
app.use(serve(__dirname + "/public"));
app.use(views(__dirname + "/public"));

// 跨域 - Using domain variable now
app.use(
  cors({
    origin: domain, // Use the domain variable from .env or default
  })
);

// Restored domain check middleware
app.use(async (ctx, next) => {
  if (domain === "*") {
    await next();
  } else {
    // Check if origin or referer matches the allowed domain
    // Note: This logic might need refinement depending on exact needs
    const origin = ctx.headers.origin;
    const referer = ctx.headers.referer;
    let allowed = false;
    if (origin && origin.includes(domain)) {
      allowed = true;
    } else if (referer && referer.includes(domain)) {
      allowed = true;
    }
    // Simple check if domain is part of origin/referer, adjust if needed
    // For exact match or multiple domains, modify this logic

    if (allowed) {
      await next();
    } else {
      ctx.status = 403;
      ctx.body = {
        code: 403,
        message: "请通过正确的域名访问",
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
