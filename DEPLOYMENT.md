# UNM-Server V2 生产环境部署指南

🚀 **完整的 Vercel 和 Netlify 部署解决方案**

## 📋 目录

- [快速开始](#快速开始)
- [Vercel 部署](#vercel-部署)
- [Netlify 部署](#netlify-部署)
- [环境变量配置](#环境变量配置)
- [数据库配置](#数据库配置)
- [缓存配置](#缓存配置)
- [监控和日志](#监控和日志)
- [故障排除](#故障排除)

## 🚀 快速开始

### 前置要求

- Node.js >= 20.0.0
- pnpm >= 9.0.0
- Git 仓库已推送到 GitHub

### 1. 克隆项目

```bash
git clone https://github.com/IIXINGCHEN/UNM-Server.git
cd UNM-Server
git checkout v2-production-ready
```

### 2. 安装依赖

```bash
pnpm install
```

### 3. 选择部署平台

- **Vercel**: 适合需要全球 CDN 和高性能的场景
- **Netlify**: 适合简单部署和快速原型

## 🔷 Vercel 部署

### 自动部署 (推荐)

1. **准备环境配置**
   ```bash
   cp .env.vercel .env.vercel.local
   # 编辑 .env.vercel.local 填写实际配置
   ```

2. **运行环境检查**
   ```bash
   node scripts/check-env.js vercel
   ```

3. **执行自动部署**
   ```bash
   chmod +x scripts/deploy-vercel.sh
   ./scripts/deploy-vercel.sh
   ```

### 手动部署

1. **安装 Vercel CLI**
   ```bash
   npm install -g vercel
   ```

2. **登录 Vercel**
   ```bash
   vercel login
   ```

3. **构建项目**
   ```bash
   pnpm run build:vercel
   ```

4. **部署**
   ```bash
   vercel --prod
   ```

### Vercel 配置说明

- **入口文件**: `api/index.js`
- **运行时**: Node.js 20.x
- **最大包大小**: 50MB
- **超时时间**: 30秒
- **推荐地区**: 香港、新加坡、东京

## 🔶 Netlify 部署

### 自动部署 (推荐)

1. **准备环境配置**
   ```bash
   cp .env.netlify .env.netlify.local
   # 编辑 .env.netlify.local 填写实际配置
   ```

2. **运行环境检查**
   ```bash
   node scripts/check-env.js netlify
   ```

3. **执行自动部署**
   ```bash
   chmod +x scripts/deploy-netlify.sh
   ./scripts/deploy-netlify.sh
   ```

### 手动部署

1. **安装 Netlify CLI**
   ```bash
   npm install -g netlify-cli
   ```

2. **登录 Netlify**
   ```bash
   netlify login
   ```

3. **构建项目**
   ```bash
   pnpm run build:netlify
   ```

4. **部署**
   ```bash
   netlify deploy --prod
   ```

### Netlify 配置说明

- **Functions 目录**: `netlify/functions`
- **入口文件**: `netlify/functions/api.js`
- **构建命令**: `pnpm run build:netlify`
- **发布目录**: `dist`

## ⚙️ 环境变量配置

### 必需变量

| 变量名 | 描述 | 示例 |
|--------|------|------|
| `NODE_ENV` | 运行环境 | `production` |
| `ALLOWED_DOMAIN` | CORS 域名 | `https://api.yourdomain.com` |
| `JWT_SECRET` | JWT 密钥 | `your-secret-key` |

### 推荐变量

| 变量名 | 描述 | Vercel | Netlify |
|--------|------|--------|---------|
| `DATABASE_URL` | 数据库连接 | PlanetScale/Neon | Supabase/PlanetScale |
| `REDIS_URL` | Redis 连接 | Upstash Redis | 可选 |
| `CACHE_ENABLED` | 启用缓存 | `true` | `true` |

### 平台特定配置

#### Vercel
- `PORT=3000`
- 推荐使用 Upstash Redis
- 推荐使用 PlanetScale 或 Neon 数据库

#### Netlify
- `PORT=8888`
- 推荐使用内存缓存
- 推荐使用 Supabase 数据库

## 🗄️ 数据库配置

### PlanetScale (推荐 Vercel)

1. 创建 PlanetScale 账户
2. 创建数据库
3. 获取连接字符串
4. 设置环境变量:
   ```
   DATABASE_URL="mysql://username:password@host.planetscale.com/database?sslaccept=strict"
   ```

### Supabase (推荐 Netlify)

1. 创建 Supabase 项目
2. 获取数据库 URL
3. 设置环境变量:
   ```
   DATABASE_URL="postgresql://username:password@host.supabase.co:5432/database"
   ```

### 数据库迁移

```bash
# 推送 schema
pnpm db:push

# 或运行迁移
pnpm db:migrate
```

## ⚡ 缓存配置

### Vercel + Upstash Redis

1. 创建 Upstash Redis 实例
2. 获取连接 URL
3. 设置环境变量:
   ```
   REDIS_ENABLED=true
   REDIS_URL="rediss://username:password@host.upstash.io:port"
   ```

### Netlify + 内存缓存

```bash
REDIS_ENABLED=false
CACHE_ENABLED=true
CACHE_DEFAULT_TTL_SECONDS=900
```

## 📊 监控和日志

### Vercel

- 查看部署: `vercel ls`
- 查看日志: `vercel logs`
- 实时日志: `vercel logs --follow`

### Netlify

- 查看状态: `netlify status`
- 查看日志: `netlify logs`
- 函数日志: `netlify functions:log`

### 健康检查

部署完成后访问:
- `https://your-domain.vercel.app/health`
- `https://your-site.netlify.app/health`

## 🔧 故障排除

### 常见问题

1. **构建失败**
   ```bash
   # 检查 Node.js 版本
   node --version
   
   # 清理并重新安装
   rm -rf node_modules dist
   pnpm install
   ```

2. **环境变量问题**
   ```bash
   # 检查环境配置
   node scripts/check-env.js vercel
   node scripts/check-env.js netlify
   ```

3. **数据库连接失败**
   - 检查 `DATABASE_URL` 格式
   - 确认数据库服务可访问
   - 验证连接字符串权限

4. **CORS 错误**
   - 检查 `ALLOWED_DOMAIN` 配置
   - 确保域名格式正确
   - 生产环境不要使用 `*`

### 调试技巧

1. **本地测试**
   ```bash
   pnpm build
   pnpm start
   ```

2. **查看详细日志**
   ```bash
   # Vercel
   vercel logs --follow
   
   # Netlify
   netlify dev
   ```

3. **环境变量验证**
   ```bash
   # 列出所有环境变量
   vercel env ls
   netlify env:list
   ```

## 🎯 性能优化

### Vercel 优化

- 启用 Edge Functions (如需要)
- 配置适当的缓存头
- 使用 Vercel Analytics

### Netlify 优化

- 启用 Build Plugins
- 配置 Edge Handlers
- 使用 Netlify Analytics

## 🔗 相关链接

- [Vercel 文档](https://vercel.com/docs)
- [Netlify 文档](https://docs.netlify.com)
- [Hono 文档](https://hono.dev)
- [Prisma 文档](https://www.prisma.io/docs)
