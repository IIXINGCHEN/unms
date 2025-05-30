# 🌐 Netlify 部署指南

## 📋 部署前准备

### 1. 环境要求
- **Node.js**: 18.x 或更高版本
- **pnpm**: 8.x 或更高版本
- **Git**: 用于代码管理
- **Netlify 账户**: [注册 Netlify](https://netlify.com)

### 2. 项目准备
确保项目已经完成构建测试：
```bash
# 安装依赖
pnpm install

# 构建项目
pnpm build

# 本地测试
pnpm start
```

## 🔧 Netlify 配置

### 1. netlify.toml 配置文件
项目已包含优化的 `netlify.toml` 配置：

```toml
[build]
  command = "pnpm build"
  functions = "netlify/functions"
  publish = "dist"

[build.environment]
  NODE_VERSION = "18"
  NPM_FLAGS = "--version"
  PNPM_VERSION = "8"

[[redirects]]
  from = "/*"
  to = "/.netlify/functions/api"
  status = 200

[functions]
  node_bundler = "esbuild"

[[headers]]
  for = "/*"
  [headers.values]
    X-Content-Type-Options = "nosniff"
    X-Frame-Options = "DENY"
    X-XSS-Protection = "1; mode=block"
    Referrer-Policy = "strict-origin-when-cross-origin"
    Permissions-Policy = "camera=(), microphone=(), geolocation=()"
    Content-Security-Policy = "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com; font-src 'self' https://fonts.gstatic.com https://cdnjs.cloudflare.com; img-src 'self' data: https:; connect-src 'self' https:; frame-ancestors 'none';"

[[headers]]
  for = "/.netlify/functions/*"
  [headers.values]
    Access-Control-Allow-Origin = "*"
    Access-Control-Allow-Methods = "GET, POST, PUT, DELETE, OPTIONS"
    Access-Control-Allow-Headers = "Content-Type, Authorization, X-Requested-With"
```

### 2. 环境变量配置

#### 必需的环境变量
```bash
NODE_ENV=production
ALLOWED_DOMAIN=https://your-site-name.netlify.app
```

#### 可选的环境变量
```bash
# 缓存配置
CACHE_ENABLED=true
CACHE_DEFAULT_TTL_SECONDS=3600

# Redis 配置 (推荐使用 Upstash)
REDIS_URL=redis://your-redis-url

# 数据库配置 (推荐使用 Supabase)
DATABASE_URL=postgresql://your-database-url

# 代理配置 (如需要)
PROXY_URL=http://your-proxy-url

# UNM 配置
UNM_TEST_SONG_ID=416892104

# GDStudio API 配置
GDSTUDIO_API_URL=https://music-api.gdstudio.xyz/api.php
GDSTUDIO_REQUEST_TIMEOUT=10000
```

## 🚀 部署步骤

### 方法一：通过 Netlify Dashboard (推荐)

#### 1. 连接 GitHub 仓库
1. 登录 [Netlify Dashboard](https://app.netlify.com/)
2. 点击 "New site from Git"
3. 选择 "GitHub"
4. 授权 Netlify 访问你的 GitHub 账户
5. 选择 UNM-Server 仓库

#### 2. 配置构建设置
1. **Branch to deploy**: `v2-production-ready` 或 `main`
2. **Build command**: `pnpm build`
3. **Publish directory**: `dist`
4. **Functions directory**: `netlify/functions`

#### 3. 高级构建设置
在 "Advanced build settings" 中添加环境变量：
```
NODE_ENV = production
ALLOWED_DOMAIN = https://your-site-name.netlify.app
CACHE_ENABLED = true
CACHE_DEFAULT_TTL_SECONDS = 3600
PNPM_VERSION = 8
```

#### 4. 部署
1. 点击 "Deploy site" 按钮
2. 等待构建完成（通常需要 3-8 分钟）
3. 部署成功后会显示站点 URL

### 方法二：通过 Netlify CLI

#### 1. 安装 Netlify CLI
```bash
npm install -g netlify-cli
```

#### 2. 登录 Netlify
```bash
netlify login
```

#### 3. 初始化项目
```bash
# 在项目根目录执行
netlify init

# 选择配置选项
# ? What would you like to do? Create & configure a new site
# ? Team: [选择你的团队]
# ? Site name (optional): unm-server-v2
# ? Your build command (hugo build/yarn run build/etc): pnpm build
# ? Directory to deploy (blank for current dir): dist
# ? Netlify functions folder: netlify/functions
```

#### 4. 设置环境变量
```bash
# 设置环境变量
netlify env:set NODE_ENV production
netlify env:set ALLOWED_DOMAIN https://your-site-name.netlify.app
netlify env:set CACHE_ENABLED true
```

#### 5. 部署
```bash
# 构建并部署
netlify deploy --prod
```

### 方法三：拖拽部署

#### 1. 本地构建
```bash
pnpm build
```

#### 2. 手动部署
1. 访问 [Netlify Drop](https://app.netlify.com/drop)
2. 将 `dist` 文件夹拖拽到页面中
3. 等待上传完成

**注意**: 此方法不支持 Netlify Functions，仅适用于静态文件部署。

## 🔧 高级配置

### 1. 自定义域名
1. 在 Netlify Dashboard 中进入站点设置
2. 点击 "Domain management"
3. 点击 "Add custom domain"
4. 输入你的域名
5. 按照提示配置 DNS 记录
6. 更新环境变量 `ALLOWED_DOMAIN` 为你的自定义域名

### 2. SSL 证书
Netlify 会自动为你的站点提供免费的 Let's Encrypt SSL 证书。

### 3. Redis 缓存配置 (推荐 Upstash)
1. 注册 [Upstash](https://upstash.com/) 账户
2. 创建 Redis 数据库
3. 获取连接 URL
4. 在 Netlify 中添加环境变量：
   ```
   REDIS_URL = redis://your-upstash-redis-url
   ```

### 4. 数据库配置 (推荐 Supabase)
1. 注册 [Supabase](https://supabase.com/) 账户
2. 创建项目和数据库
3. 获取连接字符串
4. 在 Netlify 中添加环境变量：
   ```
   DATABASE_URL = postgresql://your-supabase-url
   ```

### 5. 函数配置优化
在 `netlify.toml` 中可以配置函数超时和内存：
```toml
[functions]
  node_bundler = "esbuild"

[functions."api"]
  timeout = 30
  memory = 1024
```

## 🧪 部署后测试

### 1. 健康检查
```bash
curl https://your-site-name.netlify.app/health
```

预期响应：
```json
{
  "code": 200,
  "message": "服务健康",
  "data": {
    "status": "ok",
    "timestamp": "2025-05-30T12:00:00.000Z",
    "version": "2.0.0",
    "environment": "production",
    "platform": "netlify"
  }
}
```

### 2. API 信息
```bash
curl https://your-site-name.netlify.app/api
```

### 3. 音乐搜索测试
```bash
curl "https://your-site-name.netlify.app/api/music/search?name=test&source=netease"
```

## 🔍 故障排除

### 1. 构建失败
- 检查构建日志中的错误信息
- 确认 pnpm 版本是否正确
- 验证所有依赖都已正确安装

### 2. 函数错误
- 查看 Netlify Functions 日志
- 检查环境变量是否正确设置
- 确认函数代码没有语法错误

### 3. 部署问题
- 检查 `netlify.toml` 配置是否正确
- 确认构建命令和发布目录设置
- 验证重定向规则

### 4. 常见错误解决

#### "Function not found" 错误
- 检查 `netlify/functions` 目录是否存在
- 确认函数文件名和路径正确
- 验证函数导出格式

#### CORS 错误
- 更新 `ALLOWED_DOMAIN` 环境变量
- 检查 `netlify.toml` 中的 CORS 头部配置

#### 构建超时
- 优化构建过程
- 考虑使用缓存加速构建

## 📊 性能优化建议

### 1. 构建优化
- 启用构建缓存
- 使用 pnpm 提高安装速度
- 优化依赖管理

### 2. 函数优化
- 减少冷启动时间
- 优化函数代码
- 使用适当的内存配置

### 3. CDN 配置
- 利用 Netlify 的全球 CDN
- 配置适当的缓存头部
- 优化静态资源

## 🔗 相关链接

- [Netlify 官方文档](https://docs.netlify.com/)
- [Netlify Functions 文档](https://docs.netlify.com/functions/overview/)
- [Netlify CLI 文档](https://cli.netlify.com/)
- [Upstash Redis](https://upstash.com/)
- [Supabase 数据库](https://supabase.com/)

## 📊 性能优化建议

### 1. 构建优化
- 启用构建缓存
- 使用 pnpm 提高安装速度
- 优化依赖管理

### 2. 函数优化
- 减少冷启动时间
- 优化函数代码
- 使用适当的内存配置

### 3. CDN 配置
- 利用 Netlify 的全球 CDN
- 配置适当的缓存头部
- 优化静态资源

## 🔗 相关链接

- [Netlify 官方文档](https://docs.netlify.com/)
- [Netlify Functions 文档](https://docs.netlify.com/functions/overview/)
- [Netlify CLI 文档](https://cli.netlify.com/)
- [Upstash Redis](https://upstash.com/)
- [Supabase 数据库](https://supabase.com/)

---

**🎉 恭喜！你的 UNM-Server V2 现已成功部署到 Netlify！**
