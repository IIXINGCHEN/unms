import { z } from 'zod';

/**
 * 服务开关配置 Schema
 */
const ServiceSwitchesSchema = z.object({
  REDIS_ENABLED: z.coerce.boolean().default(true),
  DATABASE_ENABLED: z.coerce.boolean().default(true),
  LOGGING_ENABLED: z.coerce.boolean().default(true),
  RATE_LIMITING_ENABLED: z.coerce.boolean().default(true),
  HEALTH_CHECK_ENABLED: z.coerce.boolean().default(true),
  SECURITY_MIDDLEWARE_ENABLED: z.coerce.boolean().default(true),
  CORS_ENABLED: z.coerce.boolean().default(true),
  CACHE_ENABLED: z.coerce.boolean().default(true),
  METRICS_ENABLED: z.coerce.boolean().default(false),
  API_DOCS_ENABLED: z.coerce.boolean().default(true),
  GDSTUDIO_ENABLED: z.coerce.boolean().default(true),
});

/**
 * 生产环境配置验证 Schema
 */
const ProductionEnvSchema = ServiceSwitchesSchema.extend({
  NODE_ENV: z.literal('production'),
  PORT: z.coerce.number().min(1).max(65535),
  DATABASE_URL: z.string().url().startsWith('postgresql://').optional(),
  REDIS_URL: z.string().url().startsWith('redis://').optional(),
  ALLOWED_DOMAIN: z.string().refine(
    (val) => val !== '*',
    { message: '生产环境不允许使用通配符 CORS 配置' }
  ),
  // 安全相关配置
  REDIS_PASSWORD: z.string().min(8).optional(),
  JWT_SECRET: z.string().min(32).optional(),
  // API 配置
  GDSTUDIO_API_URL: z.string().url().optional(),
  GDSTUDIO_REQUEST_TIMEOUT: z.coerce.number().min(1000).max(30000).optional(),
  // 缓存配置
  CACHE_DEFAULT_TTL_SECONDS: z.coerce.number().min(60).max(86400).default(3600),
  // 速率限制配置
  GLOBAL_RATE_LIMIT_PER_MINUTE: z.coerce.number().min(1).max(1000).default(60),
  API_RATE_LIMIT_PER_MINUTE: z.coerce.number().min(1).max(500).default(30),
  SEARCH_RATE_LIMIT_PER_MINUTE: z.coerce.number().min(1).max(100).default(20),
});

/**
 * 开发环境配置验证 Schema
 */
const DevelopmentEnvSchema = ServiceSwitchesSchema.extend({
  NODE_ENV: z.string().optional().default('development'),
  PORT: z.coerce.number().min(1).max(65535).default(5678),
  ALLOWED_DOMAIN: z.string().default('*'),
  // 开发环境可选配置
  DATABASE_URL: z.string().optional(),
  REDIS_URL: z.string().optional(),
  REDIS_PASSWORD: z.string().optional(),
  GDSTUDIO_API_URL: z.string().url().optional(),
  GDSTUDIO_REQUEST_TIMEOUT: z.coerce.number().optional(),
  CACHE_DEFAULT_TTL_SECONDS: z.coerce.number().default(3600),
  // 速率限制配置（开发环境更宽松）
  GLOBAL_RATE_LIMIT_PER_MINUTE: z.coerce.number().default(120),
  API_RATE_LIMIT_PER_MINUTE: z.coerce.number().default(60),
  SEARCH_RATE_LIMIT_PER_MINUTE: z.coerce.number().default(40),
});

/**
 * 测试环境配置验证 Schema
 */
const TestEnvSchema = ServiceSwitchesSchema.extend({
  NODE_ENV: z.literal('test'),
  PORT: z.coerce.number().min(1).max(65535).default(5679),
  ALLOWED_DOMAIN: z.string().default('*'),
  // 测试环境特定配置
  DATABASE_URL: z.string().optional(),
  REDIS_URL: z.string().optional(),
  CACHE_ENABLED: z.coerce.boolean().default(false), // 测试环境默认禁用缓存
  CACHE_DEFAULT_TTL_SECONDS: z.coerce.number().default(60),
  // 测试环境速率限制（更宽松）
  GLOBAL_RATE_LIMIT_PER_MINUTE: z.coerce.number().default(1000),
  API_RATE_LIMIT_PER_MINUTE: z.coerce.number().default(500),
  SEARCH_RATE_LIMIT_PER_MINUTE: z.coerce.number().default(200),
});

/**
 * 验证环境变量配置
 */
export function validateEnvironment(): void {
  const nodeEnv = process.env.NODE_ENV || 'development';

  console.log(`🔍 正在验证 ${nodeEnv} 环境配置...`);

  try {
    let schema: z.ZodSchema;

    switch (nodeEnv) {
      case 'production':
        schema = ProductionEnvSchema;
        break;
      case 'test':
        schema = TestEnvSchema;
        break;
      default:
        schema = DevelopmentEnvSchema;
        break;
    }

    const validatedEnv = schema.parse(process.env);

    console.log(`✅ ${nodeEnv} 环境配置验证通过`);

    // 在非生产环境下显示配置摘要
    if (nodeEnv !== 'production') {
      console.log('📋 配置摘要:');
      console.log(`  - 端口: ${validatedEnv.PORT}`);
      console.log(`  - CORS: ${validatedEnv.ALLOWED_DOMAIN}`);
      console.log(`  - 缓存: ${validatedEnv.CACHE_ENABLED ? '启用' : '禁用'}`);
      console.log(`  - 数据库: ${validatedEnv.DATABASE_URL ? '已配置' : '未配置'}`);
      console.log(`  - Redis: ${validatedEnv.REDIS_URL ? '已配置' : '未配置'}`);

      // 显示服务开关状态
      console.log('🔧 服务开关状态:');
      console.log(`  - Redis: ${validatedEnv.REDIS_ENABLED ? '启用' : '禁用'}`);
      console.log(`  - 数据库: ${validatedEnv.DATABASE_ENABLED ? '启用' : '禁用'}`);
      console.log(`  - 日志: ${validatedEnv.LOGGING_ENABLED ? '启用' : '禁用'}`);
      console.log(`  - 速率限制: ${validatedEnv.RATE_LIMITING_ENABLED ? '启用' : '禁用'}`);
      console.log(`  - 安全中间件: ${validatedEnv.SECURITY_MIDDLEWARE_ENABLED ? '启用' : '禁用'}`);
      console.log(`  - 健康检查: ${validatedEnv.HEALTH_CHECK_ENABLED ? '启用' : '禁用'}`);
    }

    return validatedEnv;
  } catch (error) {
    console.error('❌ 环境变量验证失败:');

    if (error instanceof z.ZodError) {
      error.errors.forEach(err => {
        const path = err.path.join('.');
        console.error(`  - ${path}: ${err.message}`);
      });

      // 提供修复建议
      console.error('\n💡 修复建议:');
      error.errors.forEach(err => {
        const field = err.path[0] as string;
        switch (field) {
          case 'ALLOWED_DOMAIN':
            if (nodeEnv === 'production') {
              console.error(`  - 设置具体域名: ALLOWED_DOMAIN="https://yourdomain.com"`);
            }
            break;
          case 'DATABASE_URL':
            console.error(`  - 设置数据库连接: DATABASE_URL="postgresql://user:pass@host:5432/db"`);
            break;
          case 'REDIS_URL':
            console.error(`  - 设置Redis连接: REDIS_URL="redis://localhost:6379"`);
            break;
          case 'PORT':
            console.error(`  - 设置有效端口: PORT=5678`);
            break;
        }
      });
    } else {
      console.error('  - 未知验证错误:', error);
    }

    console.error('\n🔗 参考文档: 请查看 .env.example 文件获取完整配置示例');
    process.exit(1);
  }
}

/**
 * 验证必需的生产环境配置
 */
export function validateProductionRequirements(): void {
  if (process.env.NODE_ENV !== 'production') {
    return;
  }

  const requiredForProduction = [
    'DATABASE_URL',
    'REDIS_URL'
  ];

  const missing = requiredForProduction.filter(key => !process.env[key]);

  if (missing.length > 0) {
    console.error('❌ 生产环境缺少必需配置:');
    missing.forEach(key => {
      console.error(`  - ${key}`);
    });
    console.error('\n⚠️  生产环境强烈建议配置数据库和Redis以确保最佳性能和可靠性');
  }
}

/**
 * 检查配置兼容性
 */
export function checkConfigCompatibility(): void {
  const warnings: string[] = [];

  // 检查缓存配置
  if (process.env.CACHE_ENABLED === 'true' && !process.env.REDIS_URL) {
    warnings.push('启用了缓存但未配置Redis，将使用内存缓存（不推荐用于生产环境）');
  }

  // 检查端口冲突
  const port = parseInt(process.env.PORT || '5678');
  if (port === 3000 || port === 8080) {
    warnings.push(`端口 ${port} 可能与其他服务冲突，建议使用 5678`);
  }

  // 检查超时配置
  const timeout = parseInt(process.env.GDSTUDIO_REQUEST_TIMEOUT || '10000');
  if (timeout > 30000) {
    warnings.push('GDStudio API 超时时间过长，可能影响用户体验');
  }

  if (warnings.length > 0) {
    console.warn('⚠️  配置警告:');
    warnings.forEach(warning => {
      console.warn(`  - ${warning}`);
    });
  }
}

/**
 * 获取服务开关状态
 */
export function getServiceSwitches() {
  return {
    redis: process.env.REDIS_ENABLED !== 'false',
    database: process.env.DATABASE_ENABLED !== 'false',
    logging: process.env.LOGGING_ENABLED !== 'false',
    rateLimiting: process.env.RATE_LIMITING_ENABLED !== 'false',
    healthCheck: process.env.HEALTH_CHECK_ENABLED !== 'false',
    securityMiddleware: process.env.SECURITY_MIDDLEWARE_ENABLED !== 'false',
    cors: process.env.CORS_ENABLED !== 'false',
    cache: process.env.CACHE_ENABLED !== 'false',
    metrics: process.env.METRICS_ENABLED === 'true',
    apiDocs: process.env.API_DOCS_ENABLED !== 'false',
    gdstudio: process.env.GDSTUDIO_ENABLED !== 'false',
  };
}

/**
 * 检查特定服务是否启用
 */
export function isServiceEnabled(service: keyof ReturnType<typeof getServiceSwitches>): boolean {
  const switches = getServiceSwitches();
  return switches[service];
}
