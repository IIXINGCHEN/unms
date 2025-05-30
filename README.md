# UNM-Server V2

🎵 **纯后端音乐API服务** - 基于 Hono + TypeScript 的高性能音乐数据接口

> **注意**: 这是一个纯后端API服务，不包含任何前端界面。专注于提供稳定、高性能的音乐数据API接口。

## 🚀 核心特性

- **🎯 纯后端架构**: 专注于API服务，无前端依赖
- **⚡ 高性能框架**: 基于 Hono 轻量级高性能Web框架
- **🔒 类型安全**: 完整的 TypeScript 支持
- **📦 扁平化架构**: 简化的项目结构，易于维护
- **🚀 生产级缓存**: Redis + 内存缓存双重降级
- **🗄️ 数据库集成**: Prisma ORM + PostgreSQL (可选)
- **🎵 多平台支持**: 支持网易云音乐、QQ音乐等多平台数据源
- **🔧 服务开关**: 灵活的服务启用/禁用配置
- **🛡️ 安全加固**: 完整的生产环境安全措施

## 📦 项目结构

```
├── src/
│   ├── api/                # Hono API 服务
│   │   ├── routes/         # API 路由
│   │   ├── middleware/     # 中间件
│   │   ├── services/       # 业务服务
│   │   └── utils/          # 工具函数
│   ├── shared/             # 共享类型和工具
│   ├── config/             # 配置管理
│   └── database/           # 数据库集成
├── prisma/                 # 数据库 Schema
├── dist/                   # 构建输出
├── docker/                 # Docker 配置
└── docs/                   # 项目文档
```

## 🛠️ 后端技术栈

- **🌐 Web Framework**: Hono (轻量级高性能)
- **📝 Language**: TypeScript (类型安全)
- **🗄️ Database**: Prisma ORM + PostgreSQL (可选)
- **⚡ Cache**: Redis + Memory (双重降级)
- **📦 Package Manager**: pnpm (高效依赖管理)
- **🐳 Deployment**: Docker + Docker Compose
- **🔧 Runtime**: Node.js 20+ (生产稳定)

## 🚀 快速开始

### 环境要求

- Node.js >= 20.0.0
- pnpm >= 9.0.0
- PostgreSQL (可选)
- Redis (可选)

### 安装依赖

```bash
pnpm install
```

### 环境配置

复制环境变量文件：

```bash
cp .env.example .env
```

编辑 `.env` 文件配置数据库和Redis连接。

### 数据库设置

```bash
# 生成 Prisma 客户端
pnpm db:generate

# 推送数据库模式
pnpm db:push

# 运行种子数据 (可选)
pnpm db:seed
```

### 启动服务

```bash
# 开发模式
pnpm dev

# 生产模式
pnpm build
pnpm start
```

API 服务将在 http://localhost:5678 启动

## 📚 API 接口文档

> **纯后端API服务** - 所有接口返回JSON格式数据，适合各种客户端集成

### 🔗 API 端点

| 端点 | 方法 | 描述 | 响应格式 |
|------|------|------|----------|
| `/health` | GET | 服务健康检查 | JSON |
| `/health/detailed` | GET | 详细健康状态 | JSON |
| `/api` | GET | API基本信息 | JSON |
| `/api/info` | GET | API详细信息 | JSON |
| `/api/music/search` | GET | 音乐搜索接口 | JSON |
| `/api/music/url` | GET | 获取音乐播放URL | JSON |
| `/api/music/lyric` | GET | 获取歌词数据 | JSON |
| `/api/music/pic` | GET | 获取封面图片URL | JSON |

### 📖 接口文档

- **在线文档**: `http://localhost:5678/docs` (如果启用)
- **API信息**: `http://localhost:5678/api`
- **健康检查**: `http://localhost:5678/health`

## 🔧 配置

### 环境变量

| 变量名 | 描述 | 默认值 |
|--------|------|--------|
| `PORT` | API服务端口 | `5678` |
| `NODE_ENV` | 运行环境 | `development` |
| `DATABASE_URL` | 数据库连接URL | - |
| `REDIS_URL` | Redis连接URL | - |
| `CACHE_TTL` | 缓存过期时间(秒) | `3600` |

### 缓存配置

系统支持多级缓存：
1. Redis 缓存 (优先)
2. 内存缓存 (降级)
3. 直接API调用 (最后)

## 🐳 Docker 部署

```bash
# 构建镜像
pnpm docker:build

# 运行容器
pnpm docker:run
```

## 📊 监控

- 健康检查: `GET /health`
- 缓存状态: 包含在健康检查响应中
- API统计: 自动记录到数据库

## 🤝 贡献

1. Fork 项目
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 打开 Pull Request

## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情

## 🔗 相关链接

- [原版 UNM-Server](https://github.com/iamtaihan/UNM-Server)
- [Bun 文档](https://bun.sh/docs)
- [Hono 文档](https://hono.dev/)
- [Prisma 文档](https://www.prisma.io/docs)
