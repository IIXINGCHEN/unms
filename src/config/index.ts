import { z } from 'zod';

import {
  getEnvBoolean,
  getEnvNumber,
  getEnvVar,
  type AppConfig,
  type CacheConfig,
  type GdStudioConfig,
  type MusicSource,
  type UnmConfig,
  type RedisConfig,
} from '../shared/index.js';

// 导出验证函数
export { validateEnvironment, validateProductionRequirements, checkConfigCompatibility } from './validation.js';

/**
 * 验证域名格式
 */
function isValidDomain(domain: string): boolean {
  const domainRegex = /^https?:\/\/[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  return domainRegex.test(domain);
}

// 环境配置验证Schema
const EnvConfigSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  PORT: z.coerce.number().min(1).max(65535).default(5678),
  ALLOWED_DOMAIN: z.string().default('*'),
  CACHE_ENABLED: z.coerce.boolean().default(true),
  CACHE_DEFAULT_TTL_SECONDS: z.coerce.number().min(60).max(86400).default(3600),
  PROXY_URL: z.string().optional(),
  DATABASE_URL: z.string().optional(),
  REDIS_URL: z.string().optional(),
});

/**
 * 加载和验证应用配置
 */
export function loadAppConfig(): AppConfig {
  try {
    const nodeEnv = getEnvVar('NODE_ENV', 'development');
    const port = getEnvNumber('PORT', 5678, 1, 65535);
    const allowedDomainStr = getEnvVar('ALLOWED_DOMAIN', '*');
    const cacheEnabled = getEnvBoolean('CACHE_ENABLED', true);
    const cacheDefaultTTL = getEnvNumber(
      'CACHE_DEFAULT_TTL_SECONDS',
      3600,
      60,
      86400
    );
    const proxyUrl = process.env.PROXY_URL;
    const databaseUrl = process.env.DATABASE_URL;
    const redisUrl = process.env.REDIS_URL;

    // 处理域名配置
    let allowedDomain: string | string[];

    // 强制生产环境域名验证
    if (allowedDomainStr === '*' && nodeEnv === 'production') {
      throw new Error('生产环境不允许使用通配符 CORS 配置，请设置具体域名');
    }

    if (allowedDomainStr === '*') {
      allowedDomain = '*';
    } else {
      const domains = allowedDomainStr.split(',').map(domain => domain.trim());
      // 验证域名格式
      domains.forEach(domain => {
        if (!isValidDomain(domain)) {
          throw new Error(`无效的域名配置: ${domain}`);
        }
      });
      allowedDomain = domains;
    }

    const config: AppConfig = {
      port,
      nodeEnv,
      isProduction: nodeEnv === 'production',
      allowedDomain,
      cacheEnabled,
      cacheDefaultTTL,
      proxyUrl,
      databaseUrl,
      redisUrl,
    };

    // 验证配置
    EnvConfigSchema.parse({
      NODE_ENV: nodeEnv,
      PORT: port,
      ALLOWED_DOMAIN: allowedDomainStr,
      CACHE_ENABLED: cacheEnabled,
      CACHE_DEFAULT_TTL_SECONDS: cacheDefaultTTL,
      PROXY_URL: proxyUrl,
      DATABASE_URL: databaseUrl,
      REDIS_URL: redisUrl,
    });

    console.log('[配置] 应用配置加载成功');
    if (!config.isProduction) {
      console.log('[配置] 当前配置:', JSON.stringify(config, null, 2));
    }

    return config;
  } catch (error) {
    console.error('[配置错误] 配置验证失败:', error);
    process.exit(1);
  }
}

/**
 * 缓存配置
 */
export function loadCacheConfig(): CacheConfig {
  const enabled = getEnvBoolean('CACHE_ENABLED', true);
  const defaultTTL = getEnvNumber('CACHE_DEFAULT_TTL_SECONDS', 3600, 60, 86400);

  // 不同类型内容的缓存TTL配置（秒）
  const ttlConfig = {
    search: 10 * 60, // 搜索结果：10分钟
    url: 60 * 60, // 歌曲链接：1小时
    lyric: 6 * 60 * 60, // 歌词：6小时
    pic: 24 * 60 * 60, // 封面图片：24小时
    test: 60 * 60, // 测试结果：1小时
    match: 60 * 60, // 匹配结果：1小时
    default: defaultTTL, // 默认：配置值
  };

  return {
    enabled,
    defaultTTL,
    ttlConfig,
  };
}

/**
 * UNM配置
 */
export function loadUnmConfig(): UnmConfig {
  const defaultSources = [
    'pyncmd',
    'kuwo',
    'bilibili',
    'migu',
    'kugou',
    'qq',
    'youtube',
    'youtube-dl',
    'yt-dlp',
  ];

  const testSongId = getEnvVar('UNM_TEST_SONG_ID', '416892104');

  return {
    defaultSources,
    testSongId,
  };
}

/**
 * GDStudio API配置
 */
export function loadGdStudioConfig(): GdStudioConfig {
  const baseUrl = getEnvVar(
    'GDSTUDIO_API_URL',
    'https://music-api.gdstudio.xyz/api.php'
  );

  const defaultSource: MusicSource = 'netease';
  const fallbackSource: MusicSource = 'kugou';

  const validSources: MusicSource[] = [
    'netease',
    'tencent',
    'tidal',
    'spotify',
    'ytmusic',
    'qobuz',
    'joox',
    'deezer',
    'migu',
    'kugou',
    'kuwo',
    'ximalaya',
  ];

  const requestTimeout = getEnvNumber(
    'GDSTUDIO_REQUEST_TIMEOUT',
    10000,
    1000,
    30000
  );

  return {
    baseUrl,
    defaultSource,
    validSources,
    fallbackSource,
    requestTimeout,
  };
}

/**
 * Redis配置
 */
export function loadRedisConfig(): RedisConfig {
  const redisUrl = process.env.REDIS_URL;

  if (redisUrl) {
    return {
      url: redisUrl,
      keyPrefix: getEnvVar('REDIS_KEY_PREFIX', 'unm:'),
      maxRetriesPerRequest: getEnvNumber('REDIS_MAX_RETRIES', 3, 1, 10),
      retryDelayOnFailover: getEnvNumber('REDIS_RETRY_DELAY', 100, 50, 1000),
      enableReadyCheck: getEnvBoolean('REDIS_READY_CHECK', true),
      lazyConnect: getEnvBoolean('REDIS_LAZY_CONNECT', true),
      keepAlive: getEnvNumber('REDIS_KEEP_ALIVE', 30000, 1000, 60000),
      family: getEnvNumber('REDIS_FAMILY', 4, 4, 6),
    };
  }

  // 使用单独的配置项
  const config: RedisConfig = {
    host: getEnvVar('REDIS_HOST', 'localhost'),
    port: getEnvNumber('REDIS_PORT', 6379, 1, 65535),
    db: getEnvNumber('REDIS_DB', 0, 0, 15),
    keyPrefix: getEnvVar('REDIS_KEY_PREFIX', 'unm:'),
    maxRetriesPerRequest: getEnvNumber('REDIS_MAX_RETRIES', 3, 1, 10),
    retryDelayOnFailover: getEnvNumber('REDIS_RETRY_DELAY', 100, 50, 1000),
    enableReadyCheck: getEnvBoolean('REDIS_READY_CHECK', true),
    lazyConnect: getEnvBoolean('REDIS_LAZY_CONNECT', true),
    keepAlive: getEnvNumber('REDIS_KEEP_ALIVE', 30000, 1000, 60000),
    family: getEnvNumber('REDIS_FAMILY', 4, 4, 6),
  };

  // 只有在设置了密码时才添加
  if (process.env.REDIS_PASSWORD) {
    config.password = process.env.REDIS_PASSWORD;
  }

  return config;
}

/**
 * 加载所有配置
 */
export function loadAllConfigs(): {
  app: AppConfig;
  cache: CacheConfig;
  unm: UnmConfig;
  gdstudio: GdStudioConfig;
  redis: RedisConfig;
} {
  return {
    app: loadAppConfig(),
    cache: loadCacheConfig(),
    unm: loadUnmConfig(),
    gdstudio: loadGdStudioConfig(),
    redis: loadRedisConfig(),
  };
}
