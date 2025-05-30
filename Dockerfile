# 多阶段构建 - 生产环境优化
FROM node:20-alpine AS base

# 安装 pnpm
RUN npm install -g pnpm@9.15.4

# 设置工作目录
WORKDIR /app

# 复制 package 文件
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json ./apps/api/
COPY packages/*/package.json ./packages/*/

# 安装依赖
RUN pnpm install --frozen-lockfile --prod

# 构建阶段
FROM base AS builder

# 复制源代码
COPY . .

# 生成 Prisma 客户端
RUN pnpm db:generate

# 构建项目
RUN pnpm build

# 生产阶段
FROM node:20-alpine AS production

# 安装 pnpm
RUN npm install -g pnpm@9.15.4

# 创建非 root 用户
RUN addgroup -g 1001 -S nodejs
RUN adduser -S unm -u 1001

# 设置工作目录
WORKDIR /app

# 复制 package 文件
COPY --from=base /app/package.json ./
COPY --from=base /app/pnpm-workspace.yaml ./
COPY --from=base /app/apps/api/package.json ./apps/api/
COPY --from=base /app/packages/*/package.json ./packages/*/

# 复制构建产物
COPY --from=builder --chown=unm:nodejs /app/apps/api/dist ./apps/api/dist
COPY --from=builder --chown=unm:nodejs /app/packages/*/dist ./packages/*/dist
COPY --from=builder --chown=unm:nodejs /app/packages/database/prisma ./packages/database/prisma
COPY --from=builder --chown=unm:nodejs /app/packages/database/src/generated ./packages/database/src/generated

# 复制必要的配置文件
COPY --from=builder --chown=unm:nodejs /app/.env.example ./
COPY --from=builder --chown=unm:nodejs /app/node_modules ./node_modules

# 切换到非 root 用户
USER unm

# 暴露端口
EXPOSE 5678

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:5678/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# 启动命令
CMD ["pnpm", "start"]
