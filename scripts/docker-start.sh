#!/bin/bash

# UNM-Server V2 Docker 启动脚本
# 支持不同的部署场景和服务开关

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 打印带颜色的消息
print_message() {
    echo -e "${GREEN}[UNM-Server]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

# 显示帮助信息
show_help() {
    echo "UNM-Server V2 Docker 启动脚本"
    echo ""
    echo "用法: $0 [选项] [场景]"
    echo ""
    echo "场景:"
    echo "  full-stack     启动完整服务栈 (API + Redis + PostgreSQL + Nginx)"
    echo "  api-only       仅启动 API 服务"
    echo "  api-redis      启动 API + Redis"
    echo "  api-db         启动 API + PostgreSQL"
    echo "  minimal        最小化启动 (仅 API，所有外部服务禁用)"
    echo "  development    开发环境 (使用 override 配置)"
    echo ""
    echo "选项:"
    echo "  -h, --help     显示此帮助信息"
    echo "  -d, --detach   后台运行"
    echo "  -b, --build    强制重新构建镜像"
    echo "  --no-redis     禁用 Redis"
    echo "  --no-db        禁用数据库"
    echo "  --no-nginx     禁用 Nginx"
    echo "  --env-file     指定环境变量文件 (默认: .env)"
    echo ""
    echo "环境变量:"
    echo "  REDIS_ENABLED=true/false"
    echo "  DATABASE_ENABLED=true/false"
    echo "  CACHE_ENABLED=true/false"
    echo "  RATE_LIMITING_ENABLED=true/false"
    echo "  等等..."
    echo ""
    echo "示例:"
    echo "  $0 full-stack -d              # 后台启动完整服务栈"
    echo "  $0 api-redis --build          # 重新构建并启动 API + Redis"
    echo "  $0 minimal                    # 最小化启动"
    echo "  $0 development                # 开发环境启动"
}

# 检查 Docker 和 Docker Compose
check_dependencies() {
    if ! command -v docker &> /dev/null; then
        print_error "Docker 未安装或不在 PATH 中"
        exit 1
    fi

    if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
        print_error "Docker Compose 未安装或不在 PATH 中"
        exit 1
    fi
}

# 设置环境变量
setup_environment() {
    local scenario=$1
    
    case $scenario in
        "full-stack")
            export REDIS_ENABLED=true
            export DATABASE_ENABLED=true
            export NGINX_ENABLED=true
            PROFILES="--profile full-stack"
            ;;
        "api-only")
            export REDIS_ENABLED=false
            export DATABASE_ENABLED=false
            export NGINX_ENABLED=false
            PROFILES=""
            ;;
        "api-redis")
            export REDIS_ENABLED=true
            export DATABASE_ENABLED=false
            export NGINX_ENABLED=false
            PROFILES="--profile redis-enabled"
            ;;
        "api-db")
            export REDIS_ENABLED=false
            export DATABASE_ENABLED=true
            export NGINX_ENABLED=false
            PROFILES="--profile database-enabled"
            ;;
        "minimal")
            export REDIS_ENABLED=false
            export DATABASE_ENABLED=false
            export NGINX_ENABLED=false
            export CACHE_ENABLED=false
            export RATE_LIMITING_ENABLED=false
            export METRICS_ENABLED=false
            PROFILES=""
            ;;
        "development")
            export NODE_ENV=development
            COMPOSE_FILES="-f docker-compose.yml -f docker-compose.override.yml"
            PROFILES=""
            ;;
        *)
            print_error "未知场景: $scenario"
            show_help
            exit 1
            ;;
    esac
}

# 主函数
main() {
    local scenario="full-stack"
    local detach=""
    local build=""
    local env_file=".env"
    
    # 解析命令行参数
    while [[ $# -gt 0 ]]; do
        case $1 in
            -h|--help)
                show_help
                exit 0
                ;;
            -d|--detach)
                detach="-d"
                shift
                ;;
            -b|--build)
                build="--build"
                shift
                ;;
            --no-redis)
                export REDIS_ENABLED=false
                shift
                ;;
            --no-db)
                export DATABASE_ENABLED=false
                shift
                ;;
            --no-nginx)
                export NGINX_ENABLED=false
                shift
                ;;
            --env-file)
                env_file="$2"
                shift 2
                ;;
            full-stack|api-only|api-redis|api-db|minimal|development)
                scenario="$1"
                shift
                ;;
            *)
                print_error "未知选项: $1"
                show_help
                exit 1
                ;;
        esac
    done
    
    print_message "启动 UNM-Server V2 - 场景: $scenario"
    
    # 检查依赖
    check_dependencies
    
    # 设置环境
    setup_environment "$scenario"
    
    # 检查环境文件
    if [[ ! -f "$env_file" ]]; then
        print_warning "环境文件 $env_file 不存在，将使用默认配置"
    else
        print_info "使用环境文件: $env_file"
    fi
    
    # 构建 Docker Compose 命令
    local compose_cmd="docker-compose"
    if docker compose version &> /dev/null; then
        compose_cmd="docker compose"
    fi
    
    local cmd="$compose_cmd ${COMPOSE_FILES:-} --env-file $env_file $PROFILES up $detach $build"
    
    print_info "执行命令: $cmd"
    print_info "服务状态:"
    print_info "  - Redis: ${REDIS_ENABLED:-true}"
    print_info "  - Database: ${DATABASE_ENABLED:-true}"
    print_info "  - Cache: ${CACHE_ENABLED:-true}"
    print_info "  - Rate Limiting: ${RATE_LIMITING_ENABLED:-true}"
    
    # 执行命令
    eval $cmd
}

# 运行主函数
main "$@"
