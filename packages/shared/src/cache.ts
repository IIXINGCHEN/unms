import { createClient, RedisClientType } from 'redis';
import NodeCache from 'node-cache';

import type { CacheService, CacheStats, RedisConfig } from './types';
import { LogLevel } from './types';

/**
 * Redis缓存服务实现
 */
export class RedisCacheService implements CacheService {
  private client: RedisClientType | null = null;
  private fallbackCache: NodeCache;
  private stats: CacheStats;
  private isConnected = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;

  constructor(private config: RedisConfig) {
    // 初始化内存缓存作为降级方案
    this.fallbackCache = new NodeCache({
      stdTTL: 600, // 默认10分钟
      checkperiod: 120, // 每2分钟检查过期
      useClones: false,
    });

    // 初始化统计信息
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      errors: 0,
      hitRate: 0,
      totalOperations: 0,
      lastResetTime: new Date().toISOString(),
    };

    this.initializeRedis();
  }

  /**
   * 初始化Redis连接
   */
  private async initializeRedis(): Promise<void> {
    try {
      const clientConfig: any = {
        socket: {
          host: this.config.host || 'localhost',
          port: this.config.port || 6379,
          keepAlive: this.config.keepAlive || 30000,
          family: this.config.family || 4,
        },
        password: this.config.password,
        database: this.config.db || 0,
        lazyConnect: this.config.lazyConnect !== false,
      };

      if (this.config.url) {
        this.client = createClient({ url: this.config.url });
      } else {
        this.client = createClient(clientConfig);
      }

      // 设置事件监听器
      this.client.on('error', this.handleRedisError.bind(this));
      this.client.on('connect', this.handleRedisConnect.bind(this));
      this.client.on('ready', this.handleRedisReady.bind(this));
      this.client.on('end', this.handleRedisEnd.bind(this));

      // 连接Redis
      await this.client.connect();
    } catch (error) {
      this.logError('Redis初始化失败', error);
      this.handleConnectionFailure();
    }
  }

  /**
   * Redis错误处理
   */
  private handleRedisError(error: Error): void {
    this.logError('Redis连接错误', error);
    this.isConnected = false;
    this.stats.errors++;
    this.scheduleReconnect();
  }

  /**
   * Redis连接成功处理
   */
  private handleRedisConnect(): void {
    this.log('Redis连接已建立', LogLevel.INFO);
  }

  /**
   * Redis就绪处理
   */
  private handleRedisReady(): void {
    this.log('Redis连接就绪', LogLevel.INFO);
    this.isConnected = true;
    this.reconnectAttempts = 0;
  }

  /**
   * Redis连接结束处理
   */
  private handleRedisEnd(): void {
    this.log('Redis连接已断开', LogLevel.WARN);
    this.isConnected = false;
  }

  /**
   * 处理连接失败
   */
  private handleConnectionFailure(): void {
    this.isConnected = false;
    this.scheduleReconnect();
  }

  /**
   * 安排重连
   */
  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.logError('Redis重连次数超过限制，停止重连');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

    setTimeout(async () => {
      this.log(`尝试第${this.reconnectAttempts}次重连Redis...`, LogLevel.INFO);
      await this.initializeRedis();
    }, delay);
  }

  /**
   * 获取缓存值
   */
  async get<T>(key: string): Promise<T | null> {
    this.stats.totalOperations++;

    try {
      if (this.isConnected && this.client) {
        const prefixedKey = this.getPrefixedKey(key);
        const value = await this.client.get(prefixedKey);

        if (value !== null) {
          this.stats.hits++;
          this.updateHitRate();
          return JSON.parse(value) as T;
        }
      }

      // 降级到内存缓存
      const fallbackValue = this.fallbackCache.get<T>(key);
      if (fallbackValue !== undefined) {
        this.stats.hits++;
        this.updateHitRate();
        return fallbackValue;
      }

      this.stats.misses++;
      this.updateHitRate();
      return null;
    } catch (error) {
      this.logError('缓存获取失败', error);
      this.stats.errors++;
      this.stats.misses++;
      this.updateHitRate();

      // 尝试从内存缓存获取
      const fallbackValue = this.fallbackCache.get<T>(key);
      return fallbackValue !== undefined ? fallbackValue : null;
    }
  }

  /**
   * 设置缓存值
   */
  async set(key: string, value: any, ttl?: number): Promise<void> {
    this.stats.totalOperations++;
    this.stats.sets++;

    try {
      const serializedValue = JSON.stringify(value);

      if (this.isConnected && this.client) {
        const prefixedKey = this.getPrefixedKey(key);
        if (ttl) {
          await this.client.setEx(prefixedKey, ttl, serializedValue);
        } else {
          await this.client.set(prefixedKey, serializedValue);
        }
      }

      // 同时设置到内存缓存作为备份
      this.fallbackCache.set(key, value, ttl || 600);
    } catch (error) {
      this.logError('缓存设置失败', error);
      this.stats.errors++;

      // 降级到内存缓存
      this.fallbackCache.set(key, value, ttl || 600);
    }
  }

  /**
   * 删除缓存值
   */
  async del(key: string): Promise<void> {
    this.stats.totalOperations++;
    this.stats.deletes++;

    try {
      if (this.isConnected && this.client) {
        const prefixedKey = this.getPrefixedKey(key);
        await this.client.del(prefixedKey);
      }

      // 同时从内存缓存删除
      this.fallbackCache.del(key);
    } catch (error) {
      this.logError('缓存删除失败', error);
      this.stats.errors++;

      // 降级到内存缓存
      this.fallbackCache.del(key);
    }
  }

  /**
   * 检查缓存是否存在
   */
  async exists(key: string): Promise<boolean> {
    this.stats.totalOperations++;

    try {
      if (this.isConnected && this.client) {
        const prefixedKey = this.getPrefixedKey(key);
        const exists = await this.client.exists(prefixedKey);
        return exists === 1;
      }

      // 降级到内存缓存
      return this.fallbackCache.has(key);
    } catch (error) {
      this.logError('缓存存在检查失败', error);
      this.stats.errors++;
      return this.fallbackCache.has(key);
    }
  }

  /**
   * 清空缓存
   */
  async clear(): Promise<void> {
    this.stats.totalOperations++;

    try {
      if (this.isConnected && this.client) {
        await this.client.flushDb();
      }

      // 清空内存缓存
      this.fallbackCache.flushAll();
    } catch (error) {
      this.logError('缓存清空失败', error);
      this.stats.errors++;

      // 降级到内存缓存
      this.fallbackCache.flushAll();
    }
  }

  /**
   * 获取匹配的键
   */
  async keys(pattern: string): Promise<string[]> {
    this.stats.totalOperations++;

    try {
      if (this.isConnected && this.client) {
        const prefixedPattern = this.getPrefixedKey(pattern);
        const keys = await this.client.keys(prefixedPattern);
        return keys.map(key => this.removePrefixFromKey(key));
      }

      // 降级到内存缓存
      return this.fallbackCache.keys().filter(key =>
        new RegExp(pattern.replace(/\*/g, '.*')).test(key)
      );
    } catch (error) {
      this.logError('缓存键获取失败', error);
      this.stats.errors++;
      return [];
    }
  }

  /**
   * 获取TTL
   */
  async ttl(key: string): Promise<number> {
    this.stats.totalOperations++;

    try {
      if (this.isConnected && this.client) {
        const prefixedKey = this.getPrefixedKey(key);
        return await this.client.ttl(prefixedKey);
      }

      // 内存缓存的TTL获取
      const ttl = this.fallbackCache.getTtl(key);
      if (ttl === undefined) return -1;
      return Math.floor((ttl - Date.now()) / 1000);
    } catch (error) {
      this.logError('TTL获取失败', error);
      this.stats.errors++;
      return -1;
    }
  }

  /**
   * 设置过期时间
   */
  async expire(key: string, ttl: number): Promise<void> {
    this.stats.totalOperations++;

    try {
      if (this.isConnected && this.client) {
        const prefixedKey = this.getPrefixedKey(key);
        await this.client.expire(prefixedKey, ttl);
      }

      // 内存缓存设置TTL
      const value = this.fallbackCache.get(key);
      if (value !== undefined) {
        this.fallbackCache.set(key, value, ttl);
      }
    } catch (error) {
      this.logError('过期时间设置失败', error);
      this.stats.errors++;
    }
  }

  /**
   * 获取缓存统计信息
   */
  getStats(): CacheStats {
    return { ...this.stats };
  }

  /**
   * 重置统计信息
   */
  resetStats(): void {
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      errors: 0,
      hitRate: 0,
      totalOperations: 0,
      lastResetTime: new Date().toISOString(),
    };
  }

  /**
   * 获取连接状态
   */
  isHealthy(): boolean {
    return this.isConnected;
  }

  /**
   * 关闭连接
   */
  async close(): Promise<void> {
    try {
      if (this.client) {
        await this.client.quit();
      }
      this.fallbackCache.close();
    } catch (error) {
      this.logError('缓存服务关闭失败', error);
    }
  }

  /**
   * 获取带前缀的键
   */
  private getPrefixedKey(key: string): string {
    const prefix = this.config.keyPrefix || 'unm:';
    return `${prefix}${key}`;
  }

  /**
   * 移除键前缀
   */
  private removePrefixFromKey(key: string): string {
    const prefix = this.config.keyPrefix || 'unm:';
    return key.startsWith(prefix) ? key.slice(prefix.length) : key;
  }

  /**
   * 更新命中率
   */
  private updateHitRate(): void {
    const total = this.stats.hits + this.stats.misses;
    this.stats.hitRate = total > 0 ? (this.stats.hits / total) * 100 : 0;
  }

  /**
   * 记录日志
   */
  private log(message: string, level: LogLevel = LogLevel.INFO): void {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [${level.toUpperCase()}] [Redis缓存] ${message}`);
  }

  /**
   * 记录错误日志
   */
  private logError(message: string, error?: any): void {
    const timestamp = new Date().toISOString();
    console.error(`[${timestamp}] [ERROR] [Redis缓存] ${message}`, error);
  }
}

/**
 * 内存缓存服务实现
 */
export class MemoryCacheService implements CacheService {
  private cache: NodeCache;
  private stats: CacheStats;

  constructor(options?: { stdTTL?: number; checkperiod?: number }) {
    this.cache = new NodeCache({
      stdTTL: options?.stdTTL || 600, // 默认10分钟
      checkperiod: options?.checkperiod || 120, // 每2分钟检查过期
      useClones: false,
    });

    // 初始化统计信息
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      errors: 0,
      hitRate: 0,
      totalOperations: 0,
      lastResetTime: new Date().toISOString(),
    };

    // 监听缓存事件
    this.cache.on('set', () => this.stats.sets++);
    this.cache.on('del', () => this.stats.deletes++);
    this.cache.on('expired', () => this.stats.deletes++);
  }

  async get<T>(key: string): Promise<T | null> {
    this.stats.totalOperations++;

    try {
      const value = this.cache.get<T>(key);
      if (value !== undefined) {
        this.stats.hits++;
        this.updateHitRate();
        return value;
      }

      this.stats.misses++;
      this.updateHitRate();
      return null;
    } catch (error) {
      this.stats.errors++;
      this.stats.misses++;
      this.updateHitRate();
      return null;
    }
  }

  async set(key: string, value: any, ttl?: number): Promise<void> {
    this.stats.totalOperations++;

    try {
      this.cache.set(key, value, ttl || 0);
    } catch (error) {
      this.stats.errors++;
      throw error;
    }
  }

  async del(key: string): Promise<void> {
    this.stats.totalOperations++;

    try {
      this.cache.del(key);
    } catch (error) {
      this.stats.errors++;
      throw error;
    }
  }

  async exists(key: string): Promise<boolean> {
    this.stats.totalOperations++;

    try {
      return this.cache.has(key);
    } catch (error) {
      this.stats.errors++;
      return false;
    }
  }

  async clear(): Promise<void> {
    this.stats.totalOperations++;

    try {
      this.cache.flushAll();
    } catch (error) {
      this.stats.errors++;
      throw error;
    }
  }

  async keys(pattern: string): Promise<string[]> {
    this.stats.totalOperations++;

    try {
      const allKeys = this.cache.keys();
      const regex = new RegExp(pattern.replace(/\*/g, '.*'));
      return allKeys.filter(key => regex.test(key));
    } catch (error) {
      this.stats.errors++;
      return [];
    }
  }

  async ttl(key: string): Promise<number> {
    this.stats.totalOperations++;

    try {
      const ttl = this.cache.getTtl(key);
      if (ttl === undefined) return -1;
      return Math.floor((ttl - Date.now()) / 1000);
    } catch (error) {
      this.stats.errors++;
      return -1;
    }
  }

  async expire(key: string, ttl: number): Promise<void> {
    this.stats.totalOperations++;

    try {
      const value = this.cache.get(key);
      if (value !== undefined) {
        this.cache.set(key, value, ttl);
      }
    } catch (error) {
      this.stats.errors++;
      throw error;
    }
  }

  getStats(): CacheStats {
    return { ...this.stats };
  }

  resetStats(): void {
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      errors: 0,
      hitRate: 0,
      totalOperations: 0,
      lastResetTime: new Date().toISOString(),
    };
  }

  isHealthy(): boolean {
    return true; // 内存缓存总是健康的
  }

  async close(): Promise<void> {
    this.cache.close();
  }

  private updateHitRate(): void {
    const total = this.stats.hits + this.stats.misses;
    this.stats.hitRate = total > 0 ? (this.stats.hits / total) * 100 : 0;
  }
}

/**
 * 缓存工厂
 */
export class CacheFactory {
  /**
   * 创建Redis缓存服务
   */
  static createRedisCache(config: RedisConfig): RedisCacheService {
    return new RedisCacheService(config);
  }

  /**
   * 创建内存缓存服务
   */
  static createMemoryCache(options?: { stdTTL?: number; checkperiod?: number }): MemoryCacheService {
    return new MemoryCacheService(options);
  }

  /**
   * 根据配置自动选择缓存类型
   */
  static createCache(redisConfig?: RedisConfig, memoryOptions?: { stdTTL?: number; checkperiod?: number }): CacheService {
    if (redisConfig && (redisConfig.url || redisConfig.host)) {
      return new RedisCacheService(redisConfig);
    }
    return new MemoryCacheService(memoryOptions);
  }
}

/**
 * 缓存管理器 - 单例模式
 */
export class CacheManager {
  private static instance: CacheManager;
  private cacheService: CacheService | null = null;
  private isInitialized = false;

  private constructor() { }

  /**
   * 获取缓存管理器实例
   */
  static getInstance(): CacheManager {
    if (!CacheManager.instance) {
      CacheManager.instance = new CacheManager();
    }
    return CacheManager.instance;
  }

  /**
   * 初始化缓存服务
   */
  initialize(cacheService: CacheService): void {
    if (this.isInitialized) {
      throw new Error('缓存管理器已经初始化');
    }
    this.cacheService = cacheService;
    this.isInitialized = true;
  }

  /**
   * 获取缓存服务
   */
  getCache(): CacheService {
    if (!this.cacheService) {
      throw new Error('缓存服务未初始化');
    }
    return this.cacheService;
  }

  /**
   * 检查是否已初始化
   */
  isReady(): boolean {
    return this.isInitialized && this.cacheService !== null;
  }

  /**
   * 关闭缓存服务
   */
  async close(): Promise<void> {
    if (this.cacheService) {
      await this.cacheService.close();
      this.cacheService = null;
      this.isInitialized = false;
    }
  }
}

/**
 * 缓存装饰器
 */
export function cached(key: string, ttl?: number) {
  return function (_target: any, _propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const cacheManager = CacheManager.getInstance();
      if (!cacheManager.isReady()) {
        return method.apply(this, args);
      }

      const cache = cacheManager.getCache();
      const cacheKey = `${key}:${JSON.stringify(args)}`;

      try {
        // 尝试从缓存获取
        const cachedResult = await cache.get(cacheKey);
        if (cachedResult !== null) {
          return cachedResult;
        }

        // 执行原方法
        const result = await method.apply(this, args);

        // 缓存结果
        if (result !== null && result !== undefined) {
          await cache.set(cacheKey, result, ttl);
        }

        return result;
      } catch (error) {
        // 缓存失败时直接执行原方法
        return method.apply(this, args);
      }
    };

    return descriptor;
  };
}
