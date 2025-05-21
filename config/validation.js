/**
 * 配置验证模块
 * 用于验证环境变量的有效性，确保应用程序正确配置
 */

/**
 * 验证数值类型的环境变量
 * @param {string} name - 环境变量名称
 * @param {number} min - 最小允许值
 * @param {number} max - 最大允许值
 * @param {number} defaultValue - 默认值
 * @returns {number} - 验证后的值
 */
function validateNumberEnv(name, min, max, defaultValue) {
  const value = process.env[name];
  if (value === undefined) {
    console.log(`[配置] ${name} 未设置，使用默认值: ${defaultValue}`);
    return defaultValue;
  }

  const numValue = parseInt(value, 10);
  if (isNaN(numValue)) {
    console.warn(`[配置警告] ${name} 的值 "${value}" 不是有效的数字，使用默认值: ${defaultValue}`);
    return defaultValue;
  }

  if (numValue < min || numValue > max) {
    console.warn(`[配置警告] ${name} 的值 ${numValue} 超出允许范围 [${min}-${max}]，使用默认值: ${defaultValue}`);
    return defaultValue;
  }

  return numValue;
}

/**
 * 验证布尔类型的环境变量
 * @param {string} name - 环境变量名称
 * @param {boolean} defaultValue - 默认值
 * @returns {boolean} - 验证后的值
 */
function validateBooleanEnv(name, defaultValue) {
  const value = process.env[name];
  if (value === undefined) {
    console.log(`[配置] ${name} 未设置，使用默认值: ${defaultValue}`);
    return defaultValue;
  }

  // 将字符串转换为小写以进行比较
  const lowerValue = value.toLowerCase();
  if (lowerValue === 'true' || lowerValue === '1' || lowerValue === 'yes') {
    return true;
  } else if (lowerValue === 'false' || lowerValue === '0' || lowerValue === 'no') {
    return false;
  } else {
    console.warn(`[配置警告] ${name} 的值 "${value}" 不是有效的布尔值，使用默认值: ${defaultValue}`);
    return defaultValue;
  }
}

/**
 * 验证字符串类型的环境变量
 * @param {string} name - 环境变量名称
 * @param {string} defaultValue - 默认值
 * @param {boolean} required - 是否必需
 * @returns {string} - 验证后的值
 */
function validateStringEnv(name, defaultValue, required = false) {
  const value = process.env[name];
  if (value === undefined || value === '') {
    if (required) {
      throw new Error(`[配置错误] 必需的环境变量 ${name} 未设置`);
    }
    console.log(`[配置] ${name} 未设置，使用默认值: ${defaultValue || '(空字符串)'}`);
    return defaultValue || '';
  }
  return value;
}

/**
 * 验证域名列表环境变量
 * @param {string} name - 环境变量名称
 * @param {string} defaultValue - 默认值
 * @returns {string|string[]} - 验证后的值，可能是字符串或字符串数组
 */
function validateDomainEnv(name, defaultValue) {
  const value = process.env[name];
  if (value === undefined || value === '') {
    console.log(`[配置] ${name} 未设置，使用默认值: ${defaultValue}`);
    return defaultValue;
  }

  // 如果值是 '*'，直接返回
  if (value === '*') {
    if (process.env.NODE_ENV === 'production') {
      console.warn(`[配置警告] 在生产环境中使用 ${name}='*' 可能存在安全风险`);
    }
    return value;
  }

  // 处理逗号分隔的域名列表
  const domains = value.split(',').map(domain => domain.trim());
  return domains;
}

/**
 * 验证所有配置
 * 在应用启动时调用此函数以验证所有环境变量
 * @returns {object} - 验证后的配置对象
 */
function validateConfig() {
  try {
    // 验证运行环境
    const nodeEnv = validateStringEnv('NODE_ENV', 'development');
    const isProduction = nodeEnv === 'production';

    // 验证端口
    const port = validateNumberEnv('PORT', 1, 65535, 5678);

    // 验证 CORS 设置
    const allowedDomain = validateDomainEnv('ALLOWED_DOMAIN', '*');

    // 验证缓存设置
    const cacheEnabled = validateBooleanEnv('CACHE_ENABLED', true);
    const cacheDefaultTTL = validateNumberEnv('CACHE_DEFAULT_TTL_SECONDS', 60, 86400, 3600);

    // 验证 UNM 功能设置
    const enableFlac = validateBooleanEnv('ENABLE_FLAC', true);
    const selectMaxBr = validateBooleanEnv('SELECT_MAX_BR', true);
    const followSourceOrder = validateBooleanEnv('FOLLOW_SOURCE_ORDER', true);

    // 验证代理设置
    const proxyUrl = validateStringEnv('PROXY_URL', '');

    // 返回验证后的配置对象
    return {
      nodeEnv,
      isProduction,
      port,
      allowedDomain,
      cacheEnabled,
      cacheDefaultTTL,
      enableFlac,
      selectMaxBr,
      followSourceOrder,
      proxyUrl
    };
  } catch (error) {
    console.error(`配置验证失败: ${error.message}`);
    process.exit(1); // 如果验证失败，退出进程
  }
}

module.exports = {
  validateConfig,
  validateNumberEnv,
  validateBooleanEnv,
  validateStringEnv,
  validateDomainEnv
};
