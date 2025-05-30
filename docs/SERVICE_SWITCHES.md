# UNM-Server V2 服务开关配置指南

## 概述

UNM-Server V2 支持通过环境变量灵活控制各种服务的启用和禁用，这使得您可以根据不同的部署场景和需求来定制服务配置。

## 服务开关列表

### 核心服务开关

| 环境变量 | 默认值 | 描述 |
|---------|--------|------|
| `REDIS_ENABLED` | `true` | 启用/禁用 Redis 缓存服务 |
| `DATABASE_ENABLED` | `true` | 启用/禁用数据库服务 |
| `CACHE_ENABLED` | `true` | 启用/禁用缓存系统 |
| `LOGGING_ENABLED` | `true` | 启用/禁用结构化日志 |

### 安全和中间件开关

| 环境变量 | 默认值 | 描述 |
|---------|--------|------|
| `SECURITY_MIDDLEWARE_ENABLED` | `true` | 启用/禁用安全中间件 |
| `CORS_ENABLED` | `true` | 启用/禁用 CORS 保护 |
| `RATE_LIMITING_ENABLED` | `true` | 启用/禁用速率限制 |

### 功能服务开关

| 环境变量 | 默认值 | 描述 |
|---------|--------|------|
| `HEALTH_CHECK_ENABLED` | `true` | 启用/禁用健康检查端点 |
| `METRICS_ENABLED` | `false` | 启用/禁用监控指标 |
| `API_DOCS_ENABLED` | `true` | 启用/禁用 API 文档 |
| `GDSTUDIO_ENABLED` | `true` | 启用/禁用 GDStudio API |

## 使用场景

### 1. 生产环境 (完整功能)

```bash
# .env
REDIS_ENABLED=true
DATABASE_ENABLED=true
CACHE_ENABLED=true
LOGGING_ENABLED=true
RATE_LIMITING_ENABLED=true
SECURITY_MIDDLEWARE_ENABLED=true
CORS_ENABLED=true
HEALTH_CHECK_ENABLED=true
METRICS_ENABLED=true
API_DOCS_ENABLED=false  # 生产环境可能不需要文档
GDSTUDIO_ENABLED=true
```

### 2. 开发环境 (宽松配置)

```bash
# .env
REDIS_ENABLED=true
DATABASE_ENABLED=false  # 开发环境可能不需要数据库
CACHE_ENABLED=true
LOGGING_ENABLED=true
RATE_LIMITING_ENABLED=false  # 开发时禁用速率限制
SECURITY_MIDDLEWARE_ENABLED=false  # 开发时可能禁用某些安全检查
CORS_ENABLED=true
HEALTH_CHECK_ENABLED=true
METRICS_ENABLED=true
API_DOCS_ENABLED=true
GDSTUDIO_ENABLED=true
```

### 3. 测试环境 (最小化)

```bash
# .env
REDIS_ENABLED=false
DATABASE_ENABLED=false
CACHE_ENABLED=false
LOGGING_ENABLED=true
RATE_LIMITING_ENABLED=false
SECURITY_MIDDLEWARE_ENABLED=false
CORS_ENABLED=true
HEALTH_CHECK_ENABLED=true
METRICS_ENABLED=false
API_DOCS_ENABLED=false
GDSTUDIO_ENABLED=true
```

### 4. 性能测试环境

```bash
# .env
REDIS_ENABLED=true
DATABASE_ENABLED=true
CACHE_ENABLED=true
LOGGING_ENABLED=false  # 减少日志开销
RATE_LIMITING_ENABLED=false  # 性能测试时禁用限制
SECURITY_MIDDLEWARE_ENABLED=false  # 减少中间件开销
CORS_ENABLED=false
HEALTH_CHECK_ENABLED=true
METRICS_ENABLED=true  # 监控性能指标
API_DOCS_ENABLED=false
GDSTUDIO_ENABLED=true
```

## Docker Compose 集成

### 使用 Profiles

```bash
# 启动完整服务栈
docker-compose --profile full-stack up

# 仅启动 API + Redis
docker-compose --profile redis-enabled up

# 仅启动 API + 数据库
docker-compose --profile database-enabled up

# 使用启动脚本
./scripts/docker-start.sh full-stack -d
./scripts/docker-start.sh api-redis --build
./scripts/docker-start.sh minimal
```

### 环境变量覆盖

```bash
# 临时禁用 Redis
REDIS_ENABLED=false docker-compose up

# 启用所有监控功能
METRICS_ENABLED=true LOGGING_ENABLED=true docker-compose up
```

## 服务开关的影响

### Redis 开关 (`REDIS_ENABLED`)

- **启用时**: 使用 Redis 作为缓存后端，支持分布式部署
- **禁用时**: 自动降级到内存缓存，适合单实例部署

### 数据库开关 (`DATABASE_ENABLED`)

- **启用时**: 连接到 PostgreSQL 数据库，支持数据持久化
- **禁用时**: 使用内存存储，适合无状态部署

### 缓存开关 (`CACHE_ENABLED`)

- **启用时**: 启用缓存机制，提高响应速度
- **禁用时**: 直接访问数据源，适合调试和测试

### 速率限制开关 (`RATE_LIMITING_ENABLED`)

- **启用时**: 保护 API 免受滥用，适合生产环境
- **禁用时**: 无限制访问，适合开发和测试

### 安全中间件开关 (`SECURITY_MIDDLEWARE_ENABLED`)

- **启用时**: 应用所有安全头部和保护措施
- **禁用时**: 最小化安全检查，适合内网环境

## 最佳实践

### 1. 环境分离

为不同环境创建专门的 `.env` 文件：

```
.env.production    # 生产环境
.env.development   # 开发环境
.env.testing       # 测试环境
.env.staging       # 预发布环境
```

### 2. 渐进式启用

从最小配置开始，逐步启用需要的服务：

```bash
# 第一步：基础 API
REDIS_ENABLED=false
DATABASE_ENABLED=false

# 第二步：添加缓存
REDIS_ENABLED=true

# 第三步：添加数据库
DATABASE_ENABLED=true

# 第四步：启用安全功能
SECURITY_MIDDLEWARE_ENABLED=true
RATE_LIMITING_ENABLED=true
```

### 3. 监控和调试

开发阶段建议启用详细日志和监控：

```bash
LOGGING_ENABLED=true
METRICS_ENABLED=true
HEALTH_CHECK_ENABLED=true
```

### 4. 性能优化

生产环境根据实际需求调整：

```bash
# 高并发场景
REDIS_ENABLED=true
CACHE_ENABLED=true
RATE_LIMITING_ENABLED=true

# 低延迟场景
LOGGING_ENABLED=false  # 减少日志开销
SECURITY_MIDDLEWARE_ENABLED=false  # 在可信环境中
```

## 故障排除

### 常见问题

1. **Redis 连接失败但 REDIS_ENABLED=true**
   - 检查 Redis 服务是否运行
   - 验证 `REDIS_URL` 配置
   - 查看应用日志中的连接错误

2. **缓存不工作**
   - 确认 `CACHE_ENABLED=true`
   - 检查 Redis 或内存缓存状态
   - 验证缓存配置参数

3. **速率限制过于严格**
   - 调整 `*_RATE_LIMIT_PER_MINUTE` 参数
   - 或临时设置 `RATE_LIMITING_ENABLED=false`

4. **CORS 错误**
   - 检查 `ALLOWED_DOMAIN` 配置
   - 确认 `CORS_ENABLED=true`
   - 验证客户端域名设置

### 调试命令

```bash
# 查看当前服务状态
curl http://localhost:5678/health/detailed

# 检查环境变量
docker-compose config

# 查看服务日志
docker-compose logs unm-api
```

## 配置验证

应用启动时会自动验证配置并显示服务状态：

```
🔍 正在验证 development 环境配置...
✅ development 环境配置验证通过
📋 配置摘要:
  - 端口: 5678
  - CORS: *
  - 缓存: 启用
  - 数据库: 未配置
  - Redis: 已配置
🔧 服务开关状态:
  - Redis: 启用
  - 数据库: 禁用
  - 日志: 启用
  - 速率限制: 禁用
  - 安全中间件: 禁用
  - 健康检查: 启用
```
