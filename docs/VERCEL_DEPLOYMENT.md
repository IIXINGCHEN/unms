# 🚀 Vercel 部署指南

## 📋 部署前准备

### 1. 环境要求
- **Node.js**: 18.x 或更高版本
- **pnpm**: 8.x 或更高版本
- **Git**: 用于代码管理
- **Vercel 账户**: [注册 Vercel](https://vercel.com)

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

## 🔧 Vercel 配置

### 1. vercel.json 配置文件
项目已包含优化的 `vercel.json` 配置：

```json
{
  "version": 2,
  "name": "unm-server-v2",
  "builds": [
    {
      "src": "api/index.js",
      "use": "@vercel/node",
      "config": {
        "maxLambdaSize": "50mb"
      }
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "/api/index.js"
    }
  ],
  "functions": {
    "api/index.js": {
      "maxDuration": 30
    }
  },
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "X-Content-Type-Options",
          "value": "nosniff"
        },
        {
          "key": "X-Frame-Options",
          "value": "DENY"
        },
        {
          "key": "X-XSS-Protection",
          "value": "1; mode=block"
        },
        {
          "key": "Referrer-Policy",
          "value": "strict-origin-when-cross-origin"
        },
        {
          "key": "Permissions-Policy",
          "value": "camera=(), microphone=(), geolocation=()"
        }
      ]
    }
  ],
  "env": {
    "NODE_ENV": "production"
  }
}
```

### 2. 环境变量配置

#### 必需的环境变量
```bash
NODE_ENV=production
ALLOWED_DOMAIN=https://your-domain.vercel.app
```

#### 可选的环境变量
```bash
# 缓存配置
CACHE_ENABLED=true
CACHE_DEFAULT_TTL_SECONDS=3600

# Redis 配置 (推荐使用 Upstash)
REDIS_URL=redis://your-redis-url

# 数据库配置 (推荐使用 PlanetScale)
DATABASE_URL=mysql://your-database-url

# 代理配置 (如需要)
PROXY_URL=http://your-proxy-url

# UNM 配置
UNM_TEST_SONG_ID=416892104

# GDStudio API 配置
GDSTUDIO_API_URL=https://music-api.gdstudio.xyz/api.php
GDSTUDIO_REQUEST_TIMEOUT=10000
```

## 🚀 部署步骤

### 方法一：通过 Vercel Dashboard (推荐)

#### 1. 连接 GitHub 仓库
1. 登录 [Vercel Dashboard](https://vercel.com/dashboard)
2. 点击 "New Project"
3. 选择 "Import Git Repository"
4. 连接你的 GitHub 账户
5. 选择 UNM-Server 仓库

#### 2. 配置项目设置
1. **Project Name**: `unm-server-v2`
2. **Framework Preset**: `Other`
3. **Root Directory**: `./` (保持默认)
4. **Build Command**: `pnpm build`
5. **Output Directory**: `dist` (保持默认)
6. **Install Command**: `pnpm install`

#### 3. 设置环境变量
在 "Environment Variables" 部分添加：
```
NODE_ENV = production
ALLOWED_DOMAIN = https://your-project-name.vercel.app
CACHE_ENABLED = true
CACHE_DEFAULT_TTL_SECONDS = 3600
```

#### 4. 部署
1. 点击 "Deploy" 按钮
2. 等待构建完成（通常需要 2-5 分钟）
3. 部署成功后会显示项目 URL

### 方法二：通过 Vercel CLI

#### 1. 安装 Vercel CLI
```bash
npm i -g vercel
```

#### 2. 登录 Vercel
```bash
vercel login
```

#### 3. 部署项目
```bash
# 在项目根目录执行
vercel

# 首次部署会询问配置
# ? Set up and deploy "~/path/to/UNM-Server"? [Y/n] y
# ? Which scope do you want to deploy to? [选择你的账户]
# ? Link to existing project? [N/y] n
# ? What's your project's name? unm-server-v2
# ? In which directory is your code located? ./
```

#### 4. 设置环境变量
```bash
# 设置生产环境变量
vercel env add NODE_ENV production
vercel env add ALLOWED_DOMAIN https://your-project-name.vercel.app
vercel env add CACHE_ENABLED true
```

#### 5. 重新部署
```bash
vercel --prod
```

## 🔧 高级配置

### 1. 自定义域名
1. 在 Vercel Dashboard 中进入项目设置
2. 点击 "Domains" 标签
3. 添加你的自定义域名
4. 按照提示配置 DNS 记录
5. 更新环境变量 `ALLOWED_DOMAIN` 为你的自定义域名

### 2. Redis 缓存配置 (推荐 Upstash)
1. 注册 [Upstash](https://upstash.com/) 账户
2. 创建 Redis 数据库
3. 获取连接 URL
4. 在 Vercel 中添加环境变量：
   ```
   REDIS_URL = redis://your-upstash-redis-url
   ```

### 3. 数据库配置 (推荐 PlanetScale)
1. 注册 [PlanetScale](https://planetscale.com/) 账户
2. 创建数据库
3. 获取连接字符串
4. 在 Vercel 中添加环境变量：
   ```
   DATABASE_URL = mysql://your-planetscale-url
   ```

### 4. 监控和日志
1. 在 Vercel Dashboard 中查看 "Functions" 标签
2. 监控函数执行时间和错误率
3. 查看实时日志和性能指标

## 🧪 部署后测试

### 1. 健康检查
```bash
curl https://your-project-name.vercel.app/health
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
    "platform": "vercel"
  }
}
```

### 2. API 信息
```bash
curl https://your-project-name.vercel.app/api
```

### 3. 音乐搜索测试
```bash
curl "https://your-project-name.vercel.app/api/music/search?name=test&source=netease"
```

## 🔍 故障排除

### 1. 构建失败
- 检查 Node.js 版本是否兼容
- 确认所有依赖都已正确安装
- 查看构建日志中的错误信息

### 2. 运行时错误
- 检查环境变量是否正确设置
- 查看 Vercel Functions 日志
- 确认 CORS 配置是否正确

### 3. 性能问题
- 启用 Redis 缓存
- 检查函数执行时间
- 优化数据库查询

### 4. 常见错误解决

#### TypeError: Cannot read properties of undefined
- 确保所有环境变量都已设置
- 检查 `ALLOWED_DOMAIN` 配置

#### CORS 错误
- 更新 `ALLOWED_DOMAIN` 环境变量
- 确认域名格式正确（包含 https://）

#### 函数超时
- 检查外部 API 响应时间
- 考虑增加函数超时时间

## 📊 性能优化建议

### 1. 缓存策略
- 启用 Redis 缓存以提高响应速度
- 设置合适的 TTL 值

### 2. 函数优化
- 使用 Edge Functions 提高全球访问速度
- 优化冷启动时间

### 3. 监控设置
- 设置性能告警
- 定期检查错误率和响应时间

## 🔗 相关链接

- [Vercel 官方文档](https://vercel.com/docs)
- [Vercel CLI 文档](https://vercel.com/docs/cli)
- [Upstash Redis](https://upstash.com/)
- [PlanetScale 数据库](https://planetscale.com/)

---

**🎉 恭喜！你的 UNM-Server V2 现已成功部署到 Vercel！**
