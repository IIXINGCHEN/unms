/**
 * 创建成功响应
 */
export function createSuccessResponse(data, message = '请求成功', code = 200) {
  return {
    code,
    message,
    data,
    timestamp: Date.now(),
  };
}
/**
 * 创建错误响应
 */
export function createErrorResponse(message, code = 500, data = null) {
  return {
    code,
    message,
    data,
    timestamp: Date.now(),
  };
}
/**
 * 生成请求ID
 */
export function generateRequestId() {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
/**
 * 延迟函数
 */
export function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
/**
 * 安全的JSON解析
 */
export function safeJsonParse(str, fallback) {
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
}
/**
 * 验证环境变量
 */
export function getEnvVar(name, defaultValue) {
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
export function getEnvNumber(name, defaultValue, min, max) {
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
export function getEnvBoolean(name, defaultValue = false) {
  const value = process.env[name];
  if (value === undefined) {
    return defaultValue;
  }
  const lowerValue = value.toLowerCase();
  return lowerValue === 'true' || lowerValue === '1' || lowerValue === 'yes';
}
/**
 * 清理URL路径
 */
export function cleanPath(path) {
  return path.replace(/\/+/g, '/').replace(/\/$/, '') || '/';
}
/**
 * 检查是否为有效URL
 */
export function isValidUrl(str) {
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
export function formatFileSize(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}
/**
 * 格式化持续时间
 */
export function formatDuration(seconds) {
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
export function debounce(func, wait) {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}
/**
 * 节流函数
 */
export function throttle(func, limit) {
  let inThrottle;
  return (...args) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}
//# sourceMappingURL=utils.js.map
