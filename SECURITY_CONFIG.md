# UNM-Server V2 安全配置指南

## 🔒 敏感信息管理

### ⚠️ 重要安全原则

1. **永远不要在代码仓库中提交真实的敏感信息**
2. **使用环境变量或密钥管理服务**
3. **定期轮换密钥和令牌**
4. **使用强密码和复杂密钥**

## 🔑 敏感配置项

### 数据库配置
```bash
# 生产环境示例 (不要直接使用)
DATABASE_URL=postgresql://username:strong_password@host:5432/database
```

### Redis 配置
```bash
# 生产环境示例 (不要直接使用)
REDIS_URL=redis://username:strong_password@host:6379
REDIS_PASSWORD=your_strong_redis_password
```

### JWT 密钥
```bash
# 生产环境必须使用强密钥 (至少32字符)
JWT_SECRET=your_super_secure_jwt_secret_key_at_least_32_characters
```

### 音乐平台 Cookie
```bash
# 这些值需要从实际登录的浏览器中获取
NETEASE_COOKIE=your_netease_cookie
JOOX_COOKIE=your_joox_cookie
MIGU_COOKIE=your_migu_cookie
QQ_COOKIE=your_qq_cookie
YOUTUBE_KEY=your_youtube_api_key
```

## 🚀 部署平台配置

### Vercel 部署

1. **通过 Dashboard 设置**
   - 登录 Vercel Dashboard
   - 进入项目设置 → Environment Variables
   - 添加敏感环境变量

2. **通过 CLI 设置**
   ```bash
   vercel env add NETEASE_COOKIE production
   vercel env add JWT_SECRET production
   vercel env add DATABASE_URL production
   ```

### Netlify 部署

1. **通过 Dashboard 设置**
   - 登录 Netlify Dashboard
   - 进入 Site settings → Environment variables
   - 添加敏感环境变量

2. **通过 CLI 设置**
   ```bash
   netlify env:set NETEASE_COOKIE "your_cookie_value"
   netlify env:set JWT_SECRET "your_jwt_secret"
   netlify env:set DATABASE_URL "your_database_url"
   ```

### Docker 部署

1. **使用 Docker Secrets**
   ```bash
   docker secret create jwt_secret jwt_secret.txt
   docker secret create db_password db_password.txt
   ```

2. **使用环境文件**
   ```bash
   # 创建 .env.secrets (不要提交到仓库)
   echo "JWT_SECRET=your_secret" > .env.secrets
   docker run --env-file .env.secrets unm-server
   ```

### Kubernetes 部署

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: unm-server-secrets
type: Opaque
stringData:
  JWT_SECRET: "your_jwt_secret"
  DATABASE_URL: "your_database_url"
  NETEASE_COOKIE: "your_cookie"
```

## 🛡️ 安全最佳实践

### 1. 密钥生成
```bash
# 生成强 JWT 密钥
openssl rand -base64 64

# 生成随机密码
openssl rand -base64 32
```

### 2. 环境隔离
- 开发环境使用测试数据
- 生产环境使用真实但安全的配置
- 永远不要在开发环境使用生产密钥

### 3. 访问控制
```bash
# 限制 CORS 域名 (生产环境)
ALLOWED_DOMAIN=https://your-api-domain.com

# 不要在生产环境使用通配符
# ALLOWED_DOMAIN=* # ❌ 危险
```

### 4. 监控和审计
- 启用访问日志
- 监控异常访问
- 定期检查环境变量

## 📋 配置检查清单

### 部署前检查
- [ ] JWT_SECRET 已设置且足够复杂
- [ ] 数据库密码已更改且强度足够
- [ ] CORS 域名已正确配置
- [ ] 敏感信息未在代码中硬编码
- [ ] 环境变量已在部署平台设置

### 定期维护
- [ ] 每季度轮换 JWT 密钥
- [ ] 每月检查访问日志
- [ ] 及时更新过期的 Cookie
- [ ] 监控第三方 API 密钥状态

## 🚨 应急响应

### 密钥泄露处理
1. **立即轮换泄露的密钥**
2. **检查访问日志寻找异常**
3. **通知相关团队成员**
4. **更新所有部署环境**

### 联系方式
- 安全问题: security@your-domain.com
- 紧急联系: +86-xxx-xxxx-xxxx

## 📚 相关文档
- [Vercel 环境变量文档](https://vercel.com/docs/concepts/projects/environment-variables)
- [Netlify 环境变量文档](https://docs.netlify.com/configure-builds/environment-variables/)
- [Docker Secrets 文档](https://docs.docker.com/engine/swarm/secrets/)
- [Kubernetes Secrets 文档](https://kubernetes.io/docs/concepts/configuration/secret/)
