#!/bin/bash

# ===========================================
# UNM-Server V2 安全审计脚本
# ===========================================

set -e

echo "🔍 开始安全审计检查..."

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 创建临时配置文件使用官方源进行安全审计
TEMP_NPMRC=".npmrc.audit"
ORIGINAL_NPMRC=".npmrc"

echo "📋 备份当前 .npmrc 配置..."
cp "$ORIGINAL_NPMRC" "$TEMP_NPMRC.backup"

echo "🔧 创建安全审计专用配置..."
cat > "$TEMP_NPMRC" << EOF
# 临时安全审计配置 - 使用官方源
registry=https://registry.npmjs.org/
audit=true
package-lock=true
loglevel=warn
progress=false
fund=false
strict-peer-dependencies=true
shamefully-hoist=false
node-linker=isolated
network-timeout=300000
fetch-retries=3
fetch-retry-factor=10
fetch-retry-mintimeout=10000
fetch-retry-maxtimeout=60000
EOF

# 使用临时配置进行安全审计
echo "🔍 使用官方源进行安全审计..."
# 临时替换配置文件
mv "$ORIGINAL_NPMRC" "$ORIGINAL_NPMRC.backup"
mv "$TEMP_NPMRC" "$ORIGINAL_NPMRC"

pnpm audit --audit-level=moderate

AUDIT_EXIT_CODE=$?

# 检查审计结果
if [ $AUDIT_EXIT_CODE -eq 0 ]; then
    echo -e "${GREEN}✅ 安全审计通过：未发现已知安全漏洞${NC}"
elif [ $AUDIT_EXIT_CODE -eq 1 ]; then
    echo -e "${YELLOW}⚠️  安全审计发现问题：存在安全漏洞${NC}"
    echo "📋 尝试自动修复..."
    pnpm audit --fix

    # 再次检查
    echo "🔍 重新进行安全审计..."
    pnpm audit --audit-level=moderate
    SECOND_AUDIT_EXIT_CODE=$?

    if [ $SECOND_AUDIT_EXIT_CODE -eq 0 ]; then
        echo -e "${GREEN}✅ 安全漏洞已修复${NC}"
    else
        echo -e "${RED}❌ 仍存在无法自动修复的安全漏洞${NC}"
    fi
else
    echo -e "${RED}❌ 安全审计执行失败${NC}"
fi

# 检查依赖版本更新
echo "📦 检查依赖版本更新..."
pnpm outdated || true

# 清理临时文件和恢复配置
echo "🧹 清理临时文件..."
echo "📋 恢复原始 .npmrc 配置..."
mv "$ORIGINAL_NPMRC" "$TEMP_NPMRC"
mv "$ORIGINAL_NPMRC.backup" "$ORIGINAL_NPMRC"
rm -f "$TEMP_NPMRC"

echo "✅ 安全审计完成"

# 生成安全审计报告
echo "📄 生成安全审计报告..."
cat > "SECURITY_AUDIT_REPORT.md" << EOF
# UNM-Server V2 安全审计报告

## 审计时间
$(date '+%Y-%m-%d %H:%M:%S')

## 审计结果
- **安全审计状态**: $([ $AUDIT_EXIT_CODE -eq 0 ] && echo "✅ 通过" || echo "⚠️ 需要关注")
- **已知漏洞**: $([ $AUDIT_EXIT_CODE -eq 0 ] && echo "无" || echo "存在")
- **依赖包总数**: $(pnpm list --depth=0 2>/dev/null | grep -c "^[├└]" || echo "未知")

## 配置状态
- **包管理器**: pnpm $(pnpm --version)
- **Node.js 版本**: $(node --version)
- **TypeScript 版本**: $(npx tsc --version)
- **锁文件状态**: $([ -f "pnpm-lock.yaml" ] && echo "✅ 存在" || echo "❌ 缺失")

## 镜像源配置
- **主要源**: 中国镜像源 (registry.npmmirror.com)
- **安全审计源**: 官方源 (registry.npmjs.org)
- **网络优化**: 已启用

## 建议
1. 定期运行此脚本进行安全审计
2. 及时更新有安全漏洞的依赖包
3. 监控依赖包的版本更新
4. 在生产环境部署前必须通过安全审计

## 下次审计建议时间
$(date -d '+1 week' '+%Y-%m-%d')

---
*此报告由 UNM-Server V2 安全审计脚本自动生成*
EOF

echo -e "${BLUE}📄 安全审计报告已生成: SECURITY_AUDIT_REPORT.md${NC}"

# 如果存在安全问题，退出码非零
exit $AUDIT_EXIT_CODE
