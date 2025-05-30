import { createHash, randomBytes, createHmac, scryptSync } from 'crypto';
import type { ApiResponse } from './types';

/**
 * 创建成功响应
 */
export function createSuccessResponse<T>(
  data: T,
  message = '请求成功',
  code = 200
): ApiResponse<T> {
  return {
    code,
    message,
    data,
    timestamp: Date.now(),
    requestId: generateRequestId(),
  };
}

/**
 * 创建错误响应
 */
export function createErrorResponse(
  message: string,
  code = 500,
  data: unknown = null
): ApiResponse<unknown> {
  return {
    code,
    message,
    data,
    timestamp: Date.now(),
    requestId: generateRequestId(),
  };
}

/**
 * 生成安全的请求ID
 */
export function generateRequestId(): string {
  const timestamp = Date.now().toString(36);
  const randomPart = randomBytes(8).toString('hex');
  return `req_${timestamp}_${randomPart}`;
}

/**
 * 延迟函数
 */
export function delay(ms: number): Promise<void> {
  if (ms < 0) throw new Error('延迟时间不能为负数');
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 安全的JSON解析
 */
export function safeJsonParse<T>(str: string, fallback: T): T {
  if (typeof str !== 'string') return fallback;
  try {
    const parsed = JSON.parse(str);
    return parsed as T;
  } catch {
    return fallback;
  }
}

// ==================== 加密和哈希工具 ====================

/**
 * 计算MD5哈希
 */
export function calculateMD5(content: string | Buffer): string {
  if (!content) return '';
  return createHash('md5').update(content).digest('hex');
}

/**
 * 计算SHA256哈希
 */
export function calculateSHA256(content: string | Buffer): string {
  if (!content) return '';
  return createHash('sha256').update(content).digest('hex');
}

/**
 * 计算SHA512哈希
 */
export function calculateSHA512(content: string | Buffer): string {
  if (!content) return '';
  return createHash('sha512').update(content).digest('hex');
}

/**
 * 创建HMAC签名
 */
export function createHMACSignature(data: string, secret: string, algorithm: 'sha256' | 'sha512' = 'sha256'): string {
  if (!data || !secret) throw new Error('数据和密钥不能为空');
  return createHmac(algorithm, secret).update(data).digest('hex');
}

/**
 * 生成安全的随机字符串
 */
export function generateSecureRandomString(length: number = 32): string {
  if (length <= 0) throw new Error('长度必须大于0');
  return randomBytes(Math.ceil(length / 2)).toString('hex').slice(0, length);
}

/**
 * 生成密码哈希 (使用scrypt)
 */
export function hashPassword(password: string, salt?: string): { hash: string; salt: string } {
  if (!password) throw new Error('密码不能为空');
  const actualSalt = salt || randomBytes(16).toString('hex');
  const hash = scryptSync(password, actualSalt, 64).toString('hex');
  return { hash, salt: actualSalt };
}

/**
 * 验证密码
 */
export function verifyPassword(password: string, hash: string, salt: string): boolean {
  if (!password || !hash || !salt) return false;
  try {
    const derivedHash = scryptSync(password, salt, 64).toString('hex');
    return derivedHash === hash;
  } catch {
    return false;
  }
}

/**
 * 生成API密钥
 */
export function generateApiKey(prefix: string = 'ak'): string {
  const timestamp = Date.now().toString(36);
  const randomPart = randomBytes(16).toString('hex');
  return `${prefix}_${timestamp}_${randomPart}`;
}

// ==================== 环境变量工具 ====================

/**
 * 验证环境变量
 */
export function getEnvVar(name: string, defaultValue?: string): string {
  const value = process.env[name];
  if (value === undefined) {
    if (defaultValue !== undefined) {
      return defaultValue;
    }
    throw new Error(`环境变量 ${name} 未设置`);
  }
  return value;
}

/**
 * 验证数字环境变量
 */
export function getEnvNumber(
  name: string,
  defaultValue?: number,
  min?: number,
  max?: number
): number {
  const value = process.env[name];
  if (value === undefined) {
    if (defaultValue !== undefined) {
      return defaultValue;
    }
    throw new Error(`环境变量 ${name} 未设置`);
  }

  const num = parseInt(value, 10);
  if (isNaN(num)) {
    throw new Error(`环境变量 ${name} 不是有效数字: ${value}`);
  }

  if (min !== undefined && num < min) {
    throw new Error(`环境变量 ${name} 小于最小值 ${min}: ${num}`);
  }

  if (max !== undefined && num > max) {
    throw new Error(`环境变量 ${name} 大于最大值 ${max}: ${num}`);
  }

  return num;
}

/**
 * 验证布尔环境变量
 */
export function getEnvBoolean(name: string, defaultValue = false): boolean {
  const value = process.env[name];
  if (value === undefined) {
    return defaultValue;
  }

  const lowerValue = value.toLowerCase();
  return lowerValue === 'true' || lowerValue === '1' || lowerValue === 'yes';
}

// ==================== URL和路径工具 ====================

/**
 * 清理URL路径
 */
export function cleanPath(path: string): string {
  return path.replace(/\/+/g, '/').replace(/\/$/, '') || '/';
}

/**
 * 检查是否为有效URL
 */
export function isValidUrl(str: string): boolean {
  try {
    new URL(str);
    return true;
  } catch {
    return false;
  }
}

/**
 * 格式化文件大小
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';

  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

/**
 * 格式化持续时间
 */
export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs
      .toString()
      .padStart(2, '0')}`;
  }

  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

/**
 * 防抖函数
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout>;

  return (...args: Parameters<T>): void => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

/**
 * 节流函数
 */
export function throttle<T extends (...args: unknown[]) => unknown>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;

  return (...args: Parameters<T>): void => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

/**
 * 创建分页响应
 */
export function createPaginatedResponse<T>(
  items: T[],
  total: number,
  page: number,
  limit: number
): import('./types').PaginatedResponse<T> {
  const totalPages = Math.ceil(total / limit);

  return {
    items,
    total,
    page,
    limit,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1,
  };
}

/**
 * 生成缓存键
 */
export function generateCacheKey(prefix: string, ...parts: (string | number)[]): string {
  if (!prefix) throw new Error('缓存键前缀不能为空');
  const cleanParts = parts.filter(part => part !== null && part !== undefined);
  return `${prefix}:${cleanParts.join(':')}`;
}

// ==================== 异步工具 ====================

/**
 * 重试函数 (带指数退避)
 */
export async function retry<T>(
  fn: () => Promise<T>,
  maxAttempts: number = 3,
  delayMs: number = 1000,
  backoffMultiplier: number = 2
): Promise<T> {
  if (maxAttempts <= 0) throw new Error('最大重试次数必须大于0');
  if (delayMs < 0) throw new Error('延迟时间不能为负数');

  let lastError: Error;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt === maxAttempts) {
        throw lastError;
      }

      const currentDelay = delayMs * Math.pow(backoffMultiplier, attempt - 1);
      await delay(currentDelay);
    }
  }

  throw lastError!;
}

/**
 * 超时包装器
 */
export function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  timeoutMessage = '操作超时'
): Promise<T> {
  if (timeoutMs <= 0) throw new Error('超时时间必须大于0');

  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
    }),
  ]);
}

/**
 * 并发控制 - 限制并发数量
 */
export async function concurrentLimit<T>(
  tasks: (() => Promise<T>)[],
  limit: number = 5
): Promise<T[]> {
  if (limit <= 0) throw new Error('并发限制必须大于0');

  const results: T[] = [];
  const executing: Promise<void>[] = [];

  for (const task of tasks) {
    const promise = task().then(result => {
      results.push(result);
    });

    executing.push(promise);

    if (executing.length >= limit) {
      await Promise.race(executing);
      executing.splice(executing.findIndex(p => p === promise), 1);
    }
  }

  await Promise.all(executing);
  return results;
}

// ==================== 对象和数据处理工具 ====================

/**
 * 深度克隆对象 (支持循环引用检测)
 */
export function deepClone<T>(obj: T, seen = new WeakMap()): T {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  // 检测循环引用
  if (seen.has(obj as object)) {
    return seen.get(obj as object);
  }

  if (obj instanceof Date) {
    return new Date(obj.getTime()) as unknown as T;
  }

  if (obj instanceof RegExp) {
    return new RegExp(obj.source, obj.flags) as unknown as T;
  }

  if (obj instanceof Array) {
    const cloned = [] as unknown as T;
    seen.set(obj as object, cloned);
    (obj as unknown[]).forEach((item, index) => {
      (cloned as unknown[])[index] = deepClone(item, seen);
    });
    return cloned;
  }

  if (typeof obj === 'object') {
    const cloned = {} as T;
    seen.set(obj as object, cloned);
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        cloned[key] = deepClone(obj[key], seen);
      }
    }
    return cloned;
  }

  return obj;
}

/**
 * 对象差异比较 (深度比较)
 */
export function objectDiff(obj1: Record<string, unknown>, obj2: Record<string, unknown>): Record<string, { old: unknown; new: unknown }> {
  const diff: Record<string, { old: unknown; new: unknown }> = {};

  const allKeys = new Set([...Object.keys(obj1), ...Object.keys(obj2)]);

  for (const key of allKeys) {
    const val1 = obj1[key];
    const val2 = obj2[key];

    // 深度比较对象
    if (typeof val1 === 'object' && typeof val2 === 'object' && val1 !== null && val2 !== null) {
      const nestedDiff = objectDiff(val1 as Record<string, unknown>, val2 as Record<string, unknown>);
      if (Object.keys(nestedDiff).length > 0) {
        diff[key] = { old: val1, new: val2 };
      }
    } else if (val1 !== val2) {
      diff[key] = { old: val1, new: val2 };
    }
  }

  return diff;
}

/**
 * 对象扁平化
 */
export function flattenObject(obj: Record<string, unknown>, prefix = '', separator = '.'): Record<string, unknown> {
  const flattened: Record<string, unknown> = {};

  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const newKey = prefix ? `${prefix}${separator}${key}` : key;
      const value = obj[key];

      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        Object.assign(flattened, flattenObject(value as Record<string, unknown>, newKey, separator));
      } else {
        flattened[newKey] = value;
      }
    }
  }

  return flattened;
}

// ==================== 数组工具 ====================

/**
 * 数组去重 (支持对象数组)
 */
export function uniqueArray<T>(array: T[], keyFn?: (item: T) => string | number): T[] {
  if (!Array.isArray(array)) return [];

  if (!keyFn) {
    return [...new Set(array)];
  }

  const seen = new Set<string | number>();
  return array.filter(item => {
    const key = keyFn(item);
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

/**
 * 数组分块
 */
export function chunkArray<T>(array: T[], size: number): T[][] {
  if (!Array.isArray(array)) return [];
  if (size <= 0) throw new Error('分块大小必须大于0');

  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

/**
 * 数组洗牌 (Fisher-Yates算法)
 */
export function shuffleArray<T>(array: T[]): T[] {
  if (!Array.isArray(array)) return [];

  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = shuffled[i];
    shuffled[i] = shuffled[j]!;
    shuffled[j] = temp!;
  }
  return shuffled;
}

// ==================== 字符串和格式化工具 ====================

/**
 * 安全的随机字符串生成 (使用crypto)
 */
export function randomString(length: number = 8, charset: string = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'): string {
  if (length <= 0) throw new Error('长度必须大于0');
  if (!charset) throw new Error('字符集不能为空');

  let result = '';
  const bytes = randomBytes(length);

  for (let i = 0; i < length; i++) {
    result += charset.charAt(bytes[i]! % charset.length);
  }
  return result;
}

/**
 * 时间格式化 (支持更多格式)
 */
export function formatTime(date: Date | string | number, format: string = 'YYYY-MM-DD HH:mm:ss'): string {
  const d = new Date(date);

  if (isNaN(d.getTime())) {
    throw new Error('无效的日期');
  }

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const seconds = String(d.getSeconds()).padStart(2, '0');
  const milliseconds = String(d.getMilliseconds()).padStart(3, '0');

  return format
    .replace('YYYY', year.toString())
    .replace('MM', month)
    .replace('DD', day)
    .replace('HH', hours)
    .replace('mm', minutes)
    .replace('ss', seconds)
    .replace('SSS', milliseconds);
}

/**
 * 相对时间格式化
 */
export function formatRelativeTime(date: Date | string | number): string {
  const now = new Date();
  const target = new Date(date);
  const diffMs = now.getTime() - target.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return '刚刚';
  if (diffMin < 60) return `${diffMin}分钟前`;
  if (diffHour < 24) return `${diffHour}小时前`;
  if (diffDay < 30) return `${diffDay}天前`;

  return formatTime(target, 'YYYY-MM-DD');
}

/**
 * 字符串截断 (支持中文)
 */
export function truncateString(str: string, maxLength: number, suffix: string = '...'): string {
  if (typeof str !== 'string') return '';
  if (str.length <= maxLength) return str;

  return str.slice(0, maxLength - suffix.length) + suffix;
}

/**
 * 字符串转驼峰命名
 */
export function toCamelCase(str: string): string {
  return str.replace(/[-_\s]+(.)?/g, (_, char) => char ? char.toUpperCase() : '');
}

/**
 * 字符串转蛇形命名
 */
export function toSnakeCase(str: string): string {
  return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`).replace(/^_/, '');
}

/**
 * 字符串转短横线命名
 */
export function toKebabCase(str: string): string {
  return str.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`).replace(/^-/, '');
}

// ==================== 性能和监控工具 ====================

/**
 * 性能计时器
 */
export class PerformanceTimer {
  private startTime: number;
  private endTime?: number;

  constructor() {
    this.startTime = performance.now();
  }

  stop(): number {
    this.endTime = performance.now();
    return this.endTime - this.startTime;
  }

  getElapsed(): number {
    const end = this.endTime || performance.now();
    return end - this.startTime;
  }
}

/**
 * 函数执行时间测量
 */
export async function measureTime<T>(fn: () => Promise<T> | T): Promise<{ result: T; duration: number }> {
  const timer = new PerformanceTimer();
  const result = await fn();
  const duration = timer.stop();
  return { result, duration };
}

/**
 * 内存使用情况
 */
export function getMemoryUsage(): NodeJS.MemoryUsage {
  return process.memoryUsage();
}

/**
 * 格式化内存大小
 */
export function formatMemorySize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(2)} ${units[unitIndex]}`;
}
