// cacheService.js

// 引入 node-cache 模块，用于实现内存缓存
const NodeCache = require('node-cache');

// 从环境变量读取缓存的默认生存时间（秒），默认为 3600 秒 (1 小时)
const DEFAULT_TTL_SECONDS = parseInt(process.env.CACHE_DEFAULT_TTL_SECONDS, 10) || 3600;
// 从环境变量读取缓存是否启用，默认为启用 (true)。若 CACHE_ENABLED 设置为 'false' 则禁用
const CACHE_ENABLED = process.env.CACHE_ENABLED !== 'false';

// 初始化 NodeCache 实例
const cache = new NodeCache({
    stdTTL: DEFAULT_TTL_SECONDS, // 标准默认生存时间（秒）
    checkperiod: DEFAULT_TTL_SECONDS * 0.2, // 定期检查过期缓存的时间间隔（秒），设为TTL的20%
    useClones: false // 是否克隆缓存对象，false表示不克隆以提高性能，需确保外部不修改缓存对象
});

/**
 * 生成缓存键的函数
 * @param {string} prefix - 缓存键的前缀，用于区分不同类型的缓存
 * @param {object} paramsObject - 包含参数的对象，用于生成键的其余部分
 * @returns {string | null} - 生成的缓存键，如果缓存被禁用则返回 null
 */
function generateCacheKey(prefix, paramsObject) {
    // 如果缓存未启用，则不生成键，直接返回 null
    if (!CACHE_ENABLED) return null;

    // 获取参数对象的所有键并排序，以确保参数顺序不同时也能生成相同的键
    const sortedKeys = Object.keys(paramsObject || {}).sort();
    // 用于存储参数键值对字符串的数组
    const parts = [];
    // 遍历排序后的键
    for (const key of sortedKeys) {
        // 获取参数值
        const value = paramsObject[key];
        // 仅当参数值有效（不是 undefined 或 null）时才将其加入键的生成
        if (value !== undefined && value !== null) {
            parts.push(`${key}=${String(value)}`); // 将键值对格式化为 key=value 字符串
        }
    }
    // 用 '&' 连接所有参数部分
    const paramString = parts.join('&');
    // 返回完整缓存键：前缀 + (若有参数则加上':') + 参数字符串
    return paramString ? `${prefix}:${paramString}` : prefix;
}

/**
 * 从缓存中获取数据
 * @param {string} key - 要获取的数据的缓存键
 * @returns {*} - 缓存中存储的数据，如果键不存在或缓存禁用则返回 undefined
 */
function get(key) {
    // 如果缓存未启用或键无效，则直接返回 undefined
    if (!CACHE_ENABLED || !key) return undefined;

    // 从 NodeCache 实例中获取数据
    const value = cache.get(key);
    // 如果获取到数据 (缓存命中)
    if (value !== undefined) {
        // 在生产环境中，可以考虑使用更专业的日志库，并调整日志级别
        if (process.env.NODE_ENV !== 'production') {
            console.debug(`[Cache HIT] Key: ${key}`); // 记录缓存命中日志
        }
    } else {
        // 未获取到数据 (缓存未命中)
        if (process.env.NODE_ENV !== 'production') {
            console.debug(`[Cache MISS] Key: ${key}`); // 记录缓存未命中日志
        }
    }
    // 返回获取到的值 (可能为 undefined)
    return value;
}

/**
 * 将数据存入缓存
 * @param {string} key - 数据的缓存键
 * @param {*} value - 要存入缓存的数据
 * @param {number} [ttl=DEFAULT_TTL_SECONDS] - 该缓存项的生存时间（秒），默认为全局默认TTL
 * @returns {boolean} - 如果缓存启用且键有效，则返回 NodeCache set 操作的结果 (通常是 true)；否则返回 false
 */
function set(key, value, ttl = DEFAULT_TTL_SECONDS) {
    // 如果缓存未启用或键无效，则不进行存储，直接返回 false
    if (!CACHE_ENABLED || !key) return false;

    // 记录缓存设置日志
    if (process.env.NODE_ENV !== 'production') {
        console.debug(`[Cache SET] Key: ${key}, TTL: ${ttl}s`);
    }
    // 将数据存入 NodeCache 实例
    return cache.set(key, value, ttl);
}

/**
 * 从缓存中删除指定的键值对
 * @param {string} key - 要删除的数据的缓存键
 * @returns {number | undefined} - 如果缓存启用且键有效，返回删除的条目数 (通常是1或0)；否则无返回
 */
function del(key) {
    // 如果缓存未启用或键无效，则不进行删除操作
    if (!CACHE_ENABLED || !key) return;
    // 记录缓存删除日志
    if (process.env.NODE_ENV !== 'production') {
        console.debug(`[Cache DEL] Key: ${key}`);
    }
    // 从 NodeCache 实例中删除数据
    return cache.del(key);
}

/**
 * 清空所有缓存
 */
function flush() {
    // 如果缓存未启用，则不进行清空操作
    if (!CACHE_ENABLED) return;
    // 记录缓存清空日志
    if (process.env.NODE_ENV !== 'production') {
        console.debug('[Cache FLUSH] All cache flushed.');
    }
    // 清空 NodeCache 实例中的所有数据
    cache.flushAll();
}

// 导出缓存服务模块的公共接口
module.exports = {
    get, // 获取缓存方法
    set, // 设置缓存方法
    del, // 删除缓存方法
    flush, // 清空缓存方法
    generateCacheKey, // 生成缓存键的方法
    DEFAULT_TTL_SECONDS, // 导出的默认TTL，方便外部参考
    CACHE_ENABLED // 导出缓存是否启用的状态，方便外部参考
};
