# UNM-Server V2

现代化音乐API服务 - 基于 Bun + Hono + TypeScript 的高性能重构版本

## 🚀 特性

- **高性能运行时**: 基于 Bun 的极速 JavaScript 运行时
- **现代Web框架**: 使用 Hono 轻量级高性能框架
- **类型安全**: 完整的 TypeScript 支持
- **Monorepo架构**: pnpm workspaces 管理多包项目
- **生产级缓存**: Redis + 内存缓存双重降级
- **数据库集成**: Prisma ORM + PostgreSQL
- **真实API集成**: 支持网易云音乐、QQ音乐等多平台

## 📦 项目结构

```
├── apps/
│   └── api/                 # Hono API 服务
├── packages/
│   ├── shared/             # 共享类型和工具
│   ├── config/             # 配置管理
│   └── database/           # 数据库集成
└── pnpm-workspace.yaml     # Workspace 配置
```

## 🛠️ 技术栈

- **Runtime**: Bun
- **Web Framework**: Hono
- **Language**: TypeScript
- **Database**: Prisma + PostgreSQL
- **Cache**: Redis + Memory
- **Package Manager**: pnpm

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

## 📚 API 文档

访问 http://localhost:5678/docs 查看完整的API文档

### 主要端点

- `GET /health` - 健康检查
- `GET /api/music/search` - 音乐搜索
- `GET /api/music/url` - 获取音乐URL
- `GET /api/music/lyric` - 获取歌词
- `GET /api/music/pic` - 获取封面

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
