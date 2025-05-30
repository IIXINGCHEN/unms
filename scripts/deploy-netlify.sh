#!/bin/bash

# ===========================================
# UNM-Server V2 Netlify 部署脚本
# ===========================================

set -e

echo "🚀 开始 Netlify 部署流程..."

# 检查必要工具
echo "📋 检查部署环境..."

if ! command -v pnpm &> /dev/null; then
    echo "❌ pnpm 未安装，请先安装 pnpm"
    exit 1
fi

if ! command -v netlify &> /dev/null; then
    echo "❌ Netlify CLI 未安装，正在安装..."
    npm install -g netlify-cli
fi

# 检查环境变量文件
if [ ! -f ".env.netlify" ]; then
    echo "❌ .env.netlify 文件不存在，请先配置环境变量"
    echo "💡 可以复制 .env.netlify 模板并填写配置"
    exit 1
fi

# 安装依赖
echo "📦 安装依赖..."
pnpm install

# 生成 Prisma 客户端
echo "🗄️ 生成 Prisma 客户端..."
pnpm db:generate

# 构建项目
echo "🔨 构建项目..."
pnpm run build:netlify

# 检查构建产物
if [ ! -d "dist" ]; then
    echo "❌ 构建失败，dist 目录不存在"
    exit 1
fi

if [ ! -f "netlify/functions/api.js" ]; then
    echo "❌ Netlify Functions 入口文件不存在"
    exit 1
fi

echo "✅ 构建完成"

# 部署到 Netlify
echo "🚀 部署到 Netlify..."

# 检查是否已登录
if ! netlify status &> /dev/null; then
    echo "🔐 请先登录 Netlify..."
    netlify login
fi

# 初始化站点 (如果是首次部署)
if [ ! -f ".netlify/state.json" ]; then
    echo "🆕 初始化 Netlify 站点..."
    netlify init
fi

# 设置环境变量
echo "⚙️ 配置环境变量..."
while IFS='=' read -r key value; do
    if [[ $key && $value && ! $key =~ ^# ]]; then
        # 移除值两边的引号
        value=$(echo "$value" | sed 's/^"//;s/"$//')
        if [ ! -z "$value" ]; then
            echo "设置环境变量: $key"
            netlify env:set "$key" "$value" 2>/dev/null || true
        fi
    fi
done < .env.netlify

# 执行部署
echo "🚀 执行部署..."
netlify deploy --prod

echo "✅ Netlify 部署完成！"
echo ""
echo "🔗 部署信息:"
echo "   - 查看站点状态: netlify status"
echo "   - 查看部署日志: netlify logs"
echo "   - 管理环境变量: netlify env:list"
echo ""
echo "📚 后续步骤:"
echo "   1. 配置自定义域名 (可选)"
echo "   2. 设置数据库连接 (DATABASE_URL)"
echo "   3. 配置缓存策略"
echo "   4. 测试 API 端点"
