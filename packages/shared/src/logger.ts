/**
 * 结构化日志系统
 * 提供生产级别的日志记录功能，包括敏感信息过滤
 */

import { LogLevel } from './types';

// 扩展日志级别
export enum ExtendedLogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
  FATAL = 'fatal'
}

interface LogEntry {
  timestamp: string;
  level: ExtendedLogLevel;
  message: string;
  service: string;
  version: string;
  requestId?: string;
  userId?: string;
  ip?: string;
  userAgent?: string;
  endpoint?: string;
  method?: string;
  statusCode?: number;
  responseTime?: number;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
  [key: string]: any;
}

// 敏感信息字段列表
const SENSITIVE_FIELDS = [
  'password',
  'token',
  'cookie',
  'authorization',
  'auth',
  'secret',
  'key',
  'database_url',
  'redis_url',
  'connection_string',
  'api_key',
  'private_key',
  'access_token',
  'refresh_token',
  'session_id',
  'csrf_token'
];

/**
 * 过滤敏感信息
 */
export function sanitizeLog(obj: any): any {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj === 'string') {
    // 检查字符串是否包含敏感信息模式
    if (obj.length > 20 && (obj.includes('://') || obj.includes('Bearer ') || obj.includes('password='))) {
      return '[REDACTED]';
    }
    return obj;
  }

  if (typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeLog(item));
  }

  const sanitized: any = {};
  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();

    // 检查是否为敏感字段
    const isSensitive = SENSITIVE_FIELDS.some(field =>
      lowerKey.includes(field) || lowerKey.endsWith('_' + field)
    );

    if (isSensitive) {
      sanitized[key] = '[REDACTED]';
    } else {
      sanitized[key] = sanitizeLog(value);
    }
  }

  return sanitized;
}

/**
 * 简单的日志记录器实现
 * 在生产环境中应该替换为 winston 或 pino
 */
export class Logger {
  private static instance: Logger;
  private logLevel: ExtendedLogLevel;
  private service: string;
  private version: string;

  private constructor() {
    this.logLevel = (process.env.LOG_LEVEL as ExtendedLogLevel) || ExtendedLogLevel.INFO;
    this.service = 'unm-server-v2';
    this.version = '2.0.0';
  }

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  private shouldLog(level: ExtendedLogLevel): boolean {
    const levels = [ExtendedLogLevel.DEBUG, ExtendedLogLevel.INFO, ExtendedLogLevel.WARN, ExtendedLogLevel.ERROR, ExtendedLogLevel.FATAL];
    const currentLevelIndex = levels.indexOf(this.logLevel);
    const messageLevelIndex = levels.indexOf(level);
    return messageLevelIndex >= currentLevelIndex;
  }

  private formatLog(level: ExtendedLogLevel, message: string, meta: any = {}): LogEntry {
    const sanitizedMeta = sanitizeLog(meta);

    return {
      timestamp: new Date().toISOString(),
      level,
      message,
      service: this.service,
      version: this.version,
      ...sanitizedMeta
    };
  }

  private output(logEntry: LogEntry): void {
    const isProduction = process.env.NODE_ENV === 'production';

    if (isProduction) {
      // 生产环境：输出 JSON 格式
      console.log(JSON.stringify(logEntry));
    } else {
      // 开发环境：输出可读格式
      const { timestamp, level, message, service, ...meta } = logEntry;
      const metaStr = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta, null, 2)}` : '';
      console.log(`[${timestamp}] [${level.toUpperCase()}] [${service}] ${message}${metaStr}`);
    }
  }

  debug(message: string, meta?: any): void {
    if (this.shouldLog(ExtendedLogLevel.DEBUG)) {
      this.output(this.formatLog(ExtendedLogLevel.DEBUG, message, meta));
    }
  }

  info(message: string, meta?: any): void {
    if (this.shouldLog(ExtendedLogLevel.INFO)) {
      this.output(this.formatLog(ExtendedLogLevel.INFO, message, meta));
    }
  }

  warn(message: string, meta?: any): void {
    if (this.shouldLog(ExtendedLogLevel.WARN)) {
      this.output(this.formatLog(ExtendedLogLevel.WARN, message, meta));
    }
  }

  error(message: string, error?: Error | any, meta?: any): void {
    if (this.shouldLog(ExtendedLogLevel.ERROR)) {
      const errorMeta = error instanceof Error ? {
        error: {
          name: error.name,
          message: error.message,
          stack: process.env.NODE_ENV !== 'production' ? error.stack : undefined
        }
      } : { error };

      this.output(this.formatLog(ExtendedLogLevel.ERROR, message, { ...errorMeta, ...meta }));
    }
  }

  fatal(message: string, error?: Error | any, meta?: any): void {
    const errorMeta = error instanceof Error ? {
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack
      }
    } : { error };

    this.output(this.formatLog(ExtendedLogLevel.FATAL, message, { ...errorMeta, ...meta }));
  }
}

// 导出单例实例
export const logger = Logger.getInstance();

/**
 * 请求日志中间件辅助函数
 */
export function createRequestLogger() {
  return {
    logRequest: (method: string, url: string, ip?: string, userAgent?: string, requestId?: string) => {
      logger.info('请求开始', {
        method,
        endpoint: url,
        ip,
        userAgent,
        requestId
      });
    },

    logResponse: (method: string, url: string, statusCode: number, responseTime: number, requestId?: string) => {
      const level = statusCode >= 500 ? ExtendedLogLevel.ERROR :
        statusCode >= 400 ? ExtendedLogLevel.WARN : ExtendedLogLevel.INFO;

      if (level === ExtendedLogLevel.ERROR) {
        logger.error('请求完成', {
          method,
          endpoint: url,
          statusCode,
          responseTime,
          requestId
        });
      } else if (level === ExtendedLogLevel.WARN) {
        logger.warn('请求完成', {
          method,
          endpoint: url,
          statusCode,
          responseTime,
          requestId
        });
      } else {
        logger.info('请求完成', {
          method,
          endpoint: url,
          statusCode,
          responseTime,
          requestId
        });
      }
    }
  };
}
