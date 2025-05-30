import type { ApiResponse } from './types.js';
/**
 * 创建成功响应
 */
export declare function createSuccessResponse<T>(
  data: T,
  message?: string,
  code?: number
): ApiResponse<T>;
/**
 * 创建错误响应
 */
export declare function createErrorResponse(
  message: string,
  code?: number,
  data?: unknown
): ApiResponse<unknown>;
/**
 * 生成请求ID
 */
export declare function generateRequestId(): string;
/**
 * 延迟函数
 */
export declare function delay(ms: number): Promise<void>;
/**
 * 安全的JSON解析
 */
export declare function safeJsonParse<T>(str: string, fallback: T): T;
/**
 * 验证环境变量
 */
export declare function getEnvVar(name: string, defaultValue?: string): string;
/**
 * 验证数字环境变量
 */
export declare function getEnvNumber(
  name: string,
  defaultValue?: number,
  min?: number,
  max?: number
): number;
/**
 * 验证布尔环境变量
 */
export declare function getEnvBoolean(
  name: string,
  defaultValue?: boolean
): boolean;
/**
 * 清理URL路径
 */
export declare function cleanPath(path: string): string;
/**
 * 检查是否为有效URL
 */
export declare function isValidUrl(str: string): boolean;
/**
 * 格式化文件大小
 */
export declare function formatFileSize(bytes: number): string;
/**
 * 格式化持续时间
 */
export declare function formatDuration(seconds: number): string;
/**
 * 防抖函数
 */
export declare function debounce<T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void;
/**
 * 节流函数
 */
export declare function throttle<T extends (...args: unknown[]) => unknown>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void;
//# sourceMappingURL=utils.d.ts.map
