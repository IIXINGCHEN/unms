# 🐳 Docker 部署指南

## 📋 部署前准备

### 1. 环境要求
- **Docker**: 20.x 或更高版本
- **Docker Compose**: 2.x 或更高版本
- **Git**: 用于代码管理
- **至少 2GB RAM**: 推荐 4GB 或更多

### 2. 系统要求
- **Linux**: Ubuntu 20.04+, CentOS 8+, Debian 11+
- **Windows**: Windows 10/11 with WSL2
- **macOS**: macOS 10.15+

## 🔧 Docker 配置

### 1. Dockerfile 说明
项目已包含优化的多阶段构建 Dockerfile：

```dockerfile
# 构建阶段
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json pnpm-lock.yaml ./
RUN npm install -g pnpm@8
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

# 生产阶段
FROM node:18-alpine AS production
WORKDIR /app
RUN npm install -g pnpm@8
COPY package*.json pnpm-lock.yaml ./
RUN pnpm install --prod --frozen-lockfile
COPY --from=builder /app/dist ./dist
EXPOSE 5678
CMD ["node", "dist/api/index.js"]
```

### 2. docker-compose.yml 配置
完整的生产环境配置：

```yaml
version: '3.8'

services:
  unm-server:
    build: .
    ports:
      - "5678:5678"
    environment:
      - NODE_ENV=production
      - ALLOWED_DOMAIN=http://localhost:5678
      - CACHE_ENABLED=true
      - CACHE_DEFAULT_TTL_SECONDS=3600
      - REDIS_URL=redis://redis:6379
    depends_on:
      - redis
    restart: unless-stopped
    networks:
      - unm-network

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    restart: unless-stopped
    networks:
      - unm-network

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./ssl:/etc/nginx/ssl:ro
    depends_on:
      - unm-server
    restart: unless-stopped
    networks:
      - unm-network

volumes:
  redis_data:

networks:
  unm-network:
    driver: bridge
```

### 3. 环境变量配置

#### .env 文件示例
```bash
# 应用配置
NODE_ENV=production
PORT=5678
ALLOWED_DOMAIN=https://your-domain.com

# 缓存配置
CACHE_ENABLED=true
CACHE_DEFAULT_TTL_SECONDS=3600

# Redis 配置
REDIS_URL=redis://redis:6379
REDIS_KEY_PREFIX=unm:
REDIS_MAX_RETRIES=3

# 数据库配置 (可选)
DATABASE_URL=postgresql://user:password@postgres:5432/unm_server

# UNM 配置
UNM_TEST_SONG_ID=416892104

# GDStudio API 配置
GDSTUDIO_API_URL=https://music-api.gdstudio.xyz/api.php
GDSTUDIO_REQUEST_TIMEOUT=10000

# 代理配置 (如需要)
PROXY_URL=http://your-proxy:8080
```

## 🚀 部署步骤

### 方法一：使用 Docker Compose (推荐)

#### 1. 克隆项目
```bash
git clone https://github.com/IIXINGCHEN/UNM-Server.git
cd UNM-Server
git checkout v2-production-ready
```

#### 2. 配置环境变量
```bash
# 复制环境变量模板
cp .env.production .env

# 编辑环境变量
nano .env
```

#### 3. 启动服务
```bash
# 构建并启动所有服务
docker-compose up -d

# 查看日志
docker-compose logs -f unm-server
```

#### 4. 验证部署
```bash
# 健康检查
curl http://localhost:5678/health

# API 测试
curl http://localhost:5678/api
```

### 方法二：单独使用 Docker

#### 1. 构建镜像
```bash
# 构建生产镜像
docker build -t unm-server-v2:latest .

# 查看镜像
docker images | grep unm-server-v2
```

#### 2. 运行容器
```bash
# 启动 Redis (可选)
docker run -d --name redis \
  -p 6379:6379 \
  redis:7-alpine

# 启动 UNM-Server
docker run -d --name unm-server \
  -p 5678:5678 \
  -e NODE_ENV=production \
  -e ALLOWED_DOMAIN=http://localhost:5678 \
  -e CACHE_ENABLED=true \
  -e REDIS_URL=redis://redis:6379 \
  --link redis:redis \
  unm-server-v2:latest
```

#### 3. 管理容器
```bash
# 查看运行状态
docker ps

# 查看日志
docker logs -f unm-server

# 停止容器
docker stop unm-server redis

# 删除容器
docker rm unm-server redis
```

### 方法三：使用预构建镜像

#### 1. 拉取镜像
```bash
# 从 Docker Hub 拉取 (如果已发布)
docker pull your-username/unm-server-v2:latest
```

#### 2. 运行容器
```bash
docker run -d --name unm-server \
  -p 5678:5678 \
  -e NODE_ENV=production \
  -e ALLOWED_DOMAIN=http://localhost:5678 \
  your-username/unm-server-v2:latest
```

## 🔧 高级配置

### 1. Nginx 反向代理配置

#### nginx.conf 示例
```nginx
events {
    worker_connections 1024;
}

http {
    upstream unm_server {
        server unm-server:5678;
    }

    server {
        listen 80;
        server_name your-domain.com;

        location / {
            proxy_pass http://unm_server;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }
    }

    server {
        listen 443 ssl;
        server_name your-domain.com;

        ssl_certificate /etc/nginx/ssl/cert.pem;
        ssl_certificate_key /etc/nginx/ssl/key.pem;

        location / {
            proxy_pass http://unm_server;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }
    }
}
```

### 2. 数据库集成

#### 添加 PostgreSQL
在 `docker-compose.yml` 中添加：
```yaml
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: unm_server
      POSTGRES_USER: unm_user
      POSTGRES_PASSWORD: your_password
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    restart: unless-stopped
    networks:
      - unm-network

volumes:
  postgres_data:
```

### 3. 监控和日志

#### 添加监控服务
```yaml
  prometheus:
    image: prom/prometheus:latest
    ports:
      - "9090:9090"
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
    networks:
      - unm-network

  grafana:
    image: grafana/grafana:latest
    ports:
      - "3000:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
    networks:
      - unm-network
```

### 4. 健康检查配置
在 Dockerfile 中添加：
```dockerfile
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:5678/health || exit 1
```

## 🧪 部署后测试

### 1. 服务状态检查
```bash
# 检查所有服务状态
docker-compose ps

# 检查健康状态
docker-compose exec unm-server curl http://localhost:5678/health
```

### 2. 性能测试
```bash
# 使用 ab 进行压力测试
ab -n 1000 -c 10 http://localhost:5678/api

# 使用 curl 测试 API
curl "http://localhost:5678/api/music/search?name=test&source=netease"
```

### 3. 日志监控
```bash
# 实时查看日志
docker-compose logs -f

# 查看特定服务日志
docker-compose logs -f unm-server
docker-compose logs -f redis
```

## 🔍 故障排除

### 1. 容器启动失败
```bash
# 检查容器状态
docker-compose ps

# 查看详细日志
docker-compose logs unm-server

# 检查配置文件
docker-compose config
```

### 2. 网络连接问题
```bash
# 检查网络
docker network ls
docker network inspect unm-server_unm-network

# 测试容器间连接
docker-compose exec unm-server ping redis
```

### 3. 性能问题
```bash
# 查看资源使用情况
docker stats

# 检查容器资源限制
docker inspect unm-server | grep -i memory
```

### 4. 常见错误解决

#### 端口冲突
```bash
# 查看端口占用
netstat -tulpn | grep :5678

# 修改端口映射
# 在 docker-compose.yml 中修改 ports 配置
```

#### 权限问题
```bash
# 修复文件权限
sudo chown -R $USER:$USER .

# 检查 Docker 权限
sudo usermod -aG docker $USER
```

## 📊 生产环境优化

### 1. 资源限制
在 `docker-compose.yml` 中添加：
```yaml
  unm-server:
    deploy:
      resources:
        limits:
          cpus: '1.0'
          memory: 1G
        reservations:
          cpus: '0.5'
          memory: 512M
```

### 2. 安全配置
```yaml
  unm-server:
    security_opt:
      - no-new-privileges:true
    read_only: true
    tmpfs:
      - /tmp
```

### 3. 备份策略
```bash
# 备份 Redis 数据
docker-compose exec redis redis-cli BGSAVE

# 备份整个数据卷
docker run --rm -v unm-server_redis_data:/data -v $(pwd):/backup alpine tar czf /backup/redis-backup.tar.gz -C /data .
```

## 🔗 相关链接

- [Docker 官方文档](https://docs.docker.com/)
- [Docker Compose 文档](https://docs.docker.com/compose/)
- [Redis Docker 镜像](https://hub.docker.com/_/redis)
- [Nginx Docker 镜像](https://hub.docker.com/_/nginx)
- [PostgreSQL Docker 镜像](https://hub.docker.com/_/postgres)

---

**🎉 恭喜！你的 UNM-Server V2 现已成功部署到 Docker 环境！**
