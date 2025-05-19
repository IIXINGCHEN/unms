// 引入 Koa Router 模块，用于创建路由
const Router = require("koa-router");
// 引入 @unblockneteasemusic/server 模块，用于匹配和获取音乐链接
const match = require("@unblockneteasemusic/server");

// 引入 package.json 文件。
// 注意：此路径 "./package.json" 假设 router.js 与 package.json 在项目的同一根目录下。
// 如果 router.js 在子目录（如 /api 或 /routes），请将其调整为 "../package.json" 或正确的相对路径。
const packageJson = require("../package.json");

// 引入自定义的响应格式化工具函数
const { setSuccessResponse, setErrorResponse } = require('./responseUtils'); // 假设 responseUtils.js 与 router.js 同级
// 引入自定义的缓存服务模块
const cacheService = require('./cacheService'); // 假设 cacheService.js 与 router.js 同级

// --- 配置中心 ---
// GDStudio API 相关配置对象
const API_CONFIG = {
    baseUrl: "https://music-api.gdstudio.xyz/api.php", // API 基础 URL
    defaultSource: 'netease', // 默认使用的音乐源
    validSources: [ // 支持的音乐源列表
        'netease', 'tencent', 'tidal', 'spotify', 'ytmusic',
        'qobuz', 'joox', 'deezer', 'migu', 'kugou', 'kuwo', 'ximalaya'
    ],
    fallbackSource: 'kugou', // 当默认源请求失败时的回退源
    requestTimeout: 10000, // API 请求超时时间（毫秒）
};

// @unblockneteasemusic/server (UNM) 相关配置对象
const UNM_SETTINGS = {
    defaultSources: ["pyncmd", "kuwo", "bilibili", "migu", "kugou", "qq", "youtube", "youtube-dl", "yt-dlp"], // UNM 默认尝试的音源列表
    testSongId: 416892104, // 用于 /test 接口的测试歌曲 ID
};

// 从环境变量获取代理服务器 URL
const PROXY_URL_ENV = process.env.PROXY_URL;

// --- 工具函数 ---

/**
 * 异步函数：向 GDStudio API 发起请求并获取数据
 * @param {object} params - 请求参数对象，键值对形式
 * @returns {Promise<object>} - 返回 API 响应的 JSON 对象
 * @throws {Error} - 当请求失败、超时或响应状态码非 OK 时抛出错误
 */
async function fetchApiData(params) {
    // 构建带有查询参数的 API URL
    const apiUrl = new URL(API_CONFIG.baseUrl);
    // 遍历参数对象，将其添加到 URL 的查询参数中
    Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) { // 仅处理非空参数
            apiUrl.searchParams.append(key, value);
        }
    });

    // 创建 AbortController 以控制请求超时
    const controller = new AbortController();
    // 设置超时定时器，在 API_CONFIG.requestTimeout 时间后中止请求
    const timeoutId = setTimeout(() => controller.abort(), API_CONFIG.requestTimeout);

    try {
        // 在非生产环境打印详细请求日志
        if (process.env.NODE_ENV !== 'production') {
            console.log(`Workspaceing from upstream API: ${apiUrl.toString()}`);
        }
        // 发起 fetch 请求，并关联 AbortController 的 signal
        const response = await fetch(apiUrl.toString(), { signal: controller.signal });
        // 清除超时定时器，因为请求已收到响应（无论成功或失败）
        clearTimeout(timeoutId);

        // 检查响应状态码是否表示成功
        if (!response.ok) {
            // 记录上游 API 请求失败的警告信息
            console.warn(`Upstream API request failed! URL: ${apiUrl.toString()}, Status: ${response.status}, StatusText: ${response.statusText}`);
            let errorBodyText = ""; // 用于记录原始响应文本
            try {
                errorBodyText = await response.text(); // 尝试读取文本响应体
                // 在非生产环境打印详细的错误响应体
                if (process.env.NODE_ENV !== 'production') {
                    console.warn(`Upstream API response body (text): ${errorBodyText}`);
                }
                JSON.parse(errorBodyText); // 尝试解析以确认是否为有效JSON，但不直接使用其内容抛错
            } catch (e) {
                // 如果解析 JSON 失败或响应体不是JSON，记录警告
                console.warn(`Failed to parse upstream API response body as JSON or body was not JSON: ${e.message}. Original text (first 200 chars): ${errorBodyText.substring(0, 200)}...`);
            }
            // 抛出一个包含状态码的错误
            throw new Error(`API request failed with status ${response.status}.`);
        }
        // 如果请求成功，将响应体解析为 JSON 并返回
        return await response.json();
    } catch (error) {
        // 清除超时定时器，以防在其他错误路径中未被清除
        clearTimeout(timeoutId);
        // 检查错误是否由 AbortController 超时引起
        if (error.name === 'AbortError') {
            console.error(`Upstream API request timed out: ${apiUrl.toString()}`); // 记录超时错误
            throw new Error('API request timed out'); // 抛出超时特定错误
        }
        // 记录其他类型的 fetch 错误
        console.error(`Error during fetchApiData for [${apiUrl.toString()}]:`, error.message);
        // 重新抛出原始错误，由调用方处理
        throw error;
    }
}

/**
 * 处理 API 请求过程中的错误，并使用标准格式设置 Koa 上下文 (ctx) 的响应
 * @param {object} ctx - Koa 的上下文对象
 * @param {Error} error - 捕获到的错误对象
 * @param {string} [requestedSource=API_CONFIG.defaultSource] - 发生错误的请求所使用的音源
 */
function handleApiError(ctx, error, requestedSource = API_CONFIG.defaultSource) {
    // 在服务端记录错误信息，包含请求路径和音源
    console.error(`Request to ${ctx.path} failed (source: ${requestedSource}):`, error.message);
    // 在非生产环境下，打印错误堆栈信息以便调试 (生产环境应依赖外部日志系统收集堆栈)
    if (process.env.NODE_ENV !== 'production' && error.stack) {
        console.error(error.stack);
    }

    let statusCode = 500; // 默认错误状态码为 500 (服务器内部错误)
    let clientMessage = "服务器内部错误，请稍后重试。"; // 默认返回给客户端的安全错误消息
    // 根据请求的音源生成用于错误消息的文本
    const sourceText = requestedSource === API_CONFIG.defaultSource ? '默认源' : `'${requestedSource}'`;

    // 根据错误类型定制状态码和客户端消息
    if (error.message === 'API request timed out') { // 如果是请求超时错误
        statusCode = 504; // Gateway Timeout
        clientMessage = `请求上游 API (${sourceText}) 超时，请稍后重试。`;
    } else if (error.message.includes("API request failed with status")) { // 如果是 API 返回非 OK 状态
        // 尝试从错误消息中提取上游 API 返回的状态码
        const matchStatus = error.message.match(/status (\d+)/);
        const upstreamStatusCode = matchStatus ? parseInt(matchStatus[1], 10) : 502; // 默认为 502 (Bad Gateway)
        // 确保状态码在有效范围内，否则使用 502
        statusCode = (upstreamStatusCode >= 100 && upstreamStatusCode <= 599) ? upstreamStatusCode : 502;
        clientMessage = `请求上游源 ${sourceText} 失败 (状态码: ${statusCode})。该源可能暂时不可用。`;
    }
    // 使用 setErrorResponse 工具函数设置标准错误响应，data 部分为 null
    setErrorResponse(ctx, clientMessage, statusCode, null);
}

/**
 * 根据环境变量配置，为特定的音乐源 URL 生成代理 URL
 * @param {string} url - 原始音乐 URL
 * @param {string} [proxyBaseUrl=PROXY_URL_ENV] - 代理服务器的基础 URL，默认为环境变量 PROXY_URL
 * @returns {string | null} - 生成的代理 URL，或在不满足代理条件时返回 null
 */
function generateProxyUrl(url, proxyBaseUrl = PROXY_URL_ENV) {
    // 检查是否配置了代理基础 URL，以及原始 URL 是否存在且包含特定域名 (kuwo.cn 或 kugou.com)
    if (proxyBaseUrl && url && (url.includes("kuwo.cn") || url.includes("kugou.com"))) {
        // 判断原始 URL 的协议 (http 或 https)
        const protocol = url.startsWith('https://') ? 'https://' : 'http://';
        // 移除原始 URL 的协议部分
        const urlWithoutProtocol = url.substring(protocol.length);
        // 拼接代理 URL，确保 proxyBaseUrl 末尾没有多余的斜杠
        return `${proxyBaseUrl.replace(/\/$/, '')}/${protocol}${urlWithoutProtocol}`;
    }
    // 如果不满足代理条件，返回 null
    return null;
}

/**
 * 执行 API 调用，并在主源失败时尝试回退到备用源，同时集成缓存逻辑和标准响应格式
 * @param {object} ctx - Koa 的上下文对象
 * @param {object} initialApiParams - 初始 API 请求的参数对象，包含 types, id, source 等
 * @param {Function} processDataFn - 处理从 API 获取到的原始结果并返回客户端所需格式数据的函数
 * @param {object} originalQueryParams - Koa 请求中的原始查询参数对象 (ctx.request.query)
 * @param {boolean} [applyProxy=false] - 是否对结果中的 URL 应用代理逻辑
 */
async function performApiCallWithFallback(ctx, initialApiParams, processDataFn, originalQueryParams, applyProxy = false) {
    // 获取原始请求的音源
    const originalSource = initialApiParams.source;

    // 构建用于缓存键的参数对象，不包含 types 因为它将作为前缀的一部分
    const paramsForCacheKey = { ...initialApiParams };
    delete paramsForCacheKey.types; // 'types' 已在 cachePrefix 中

    // 生成缓存键前缀，格式为 "gdstudio:[API类型]"
    const cachePrefix = `gdstudio:${initialApiParams.types}`;
    // 使用缓存服务生成完整的缓存键
    const cacheKey = cacheService.generateCacheKey(cachePrefix, paramsForCacheKey);

    // 检查缓存是否启用以及缓存键是否有效
    if (cacheService.CACHE_ENABLED && cacheKey) {
        // 从缓存服务获取数据
        const cachedData = cacheService.get(cacheKey);
        // 如果缓存中存在数据 (缓存命中)
        if (cachedData !== undefined) {
            // 在非生产环境记录缓存命中日志
            if (process.env.NODE_ENV !== 'production') {
                console.log(`[Cache HIT] Serving GDStudio API call from cache for key: ${cacheKey}`);
            }
            let responseData = cachedData; // 从缓存获取的数据已经是 processDataFn 处理过的格式
            // 如果需要应用代理，并且响应数据中有 URL
            if (applyProxy && responseData.url) {
                const proxiedUrl = generateProxyUrl(responseData.url); // 生成代理 URL
                if (proxiedUrl) responseData.proxyUrl = proxiedUrl; // 如果代理 URL 有效，则添加到响应数据中
            }
            // 确定消息中显示的音源，优先使用缓存数据中的 source 字段
            const messageSource = responseData.source || originalSource;
            // 使用 setSuccessResponse 设置标准成功响应
            setSuccessResponse(ctx, responseData, `请求成功 (源: ${messageSource}, from cache)`);
            return; // 直接返回，不再执行 API 调用
        }
    }

    try {
        // 缓存未命中或缓存禁用，执行实际的 API 调用 (主源)
        const result = await fetchApiData(initialApiParams);
        // 使用 processDataFn 处理 API 返回的原始结果
        let responseData = processDataFn(result, originalSource, originalQueryParams);

        // 如果缓存启用、缓存键有效且响应数据存在
        if (cacheService.CACHE_ENABLED && cacheKey && responseData) {
            // 在缓存前，确保 responseData 中包含 source 字段，以便缓存命中时能正确显示来源
            if (typeof responseData === 'object' && responseData !== null && !responseData.source && initialApiParams.source) {
                 if (Array.isArray(responseData)) { // 如果响应数据是数组 (如搜索结果)
                    responseData.forEach(item => item.source = initialApiParams.source); // 为数组中每个对象添加 source
                 } else { // 如果响应数据是单个对象
                    responseData.source = initialApiParams.source; // 直接添加 source
                 }
            }
            // 将处理后的数据存入缓存
            cacheService.set(cacheKey, responseData);
        }

        // 如果需要应用代理，并且响应数据中有 URL
        if (applyProxy && responseData.url) {
            const proxiedUrl = generateProxyUrl(responseData.url); // 生成代理 URL
            if (proxiedUrl) responseData.proxyUrl = proxiedUrl; // 添加到响应数据
        }
        // 使用 setSuccessResponse 设置标准成功响应
        setSuccessResponse(ctx, responseData, `请求成功 (源: ${originalSource})`);
    } catch (error) {
        // 如果主源请求失败 (特定错误类型) 且当前源不是回退源本身
        if ((error.message.includes("API request failed") || error.message === 'API request timed out') &&
            originalSource !== API_CONFIG.fallbackSource) {
            // 记录尝试回退的警告信息
            console.warn(`Source '${originalSource}' (API type: ${initialApiParams.types}) failed. Attempting fallback to '${API_CONFIG.fallbackSource}'...`);
            try {
                // 构建回退源的 API 请求参数
                const fallbackApiParams = { ...initialApiParams, source: API_CONFIG.fallbackSource };
                // 向回退源发起 API 请求
                const fallbackResult = await fetchApiData(fallbackApiParams);
                // 使用 processDataFn 处理回退源返回的原始结果
                let responseData = processDataFn(fallbackResult, API_CONFIG.fallbackSource, originalQueryParams);

                // 如果缓存启用、缓存键有效且回退响应数据存在
                if (cacheService.CACHE_ENABLED && cacheKey && responseData) {
                    // 在缓存前，确保 responseData 中包含 source 字段 (此时为回退源)
                    if (typeof responseData === 'object' && responseData !== null && !responseData.source) {
                        if (Array.isArray(responseData)) { // 处理数组情况
                           responseData.forEach(item => item.source = API_CONFIG.fallbackSource);
                        } else { // 处理单个对象情况
                           responseData.source = API_CONFIG.fallbackSource;
                        }
                   }
                    // 将回退源的结果存入缓存，使用原始请求的 cacheKey
                    cacheService.set(cacheKey, responseData); 
                }
                
                // 如果需要对回退源结果应用代理
                if (applyProxy && responseData.url) {
                    const proxiedUrl = generateProxyUrl(responseData.url);
                    if (proxiedUrl) responseData.proxyUrl = proxiedUrl;
                }
                // 记录回退成功的日志
                console.log(`API type '${initialApiParams.types}' successfully retrieved from fallback '${API_CONFIG.fallbackSource}'. ID/Name: ${initialApiParams.id || initialApiParams.name || 'N/A'}`);
                // 使用 setSuccessResponse 设置标准成功响应
                setSuccessResponse(ctx, responseData, `请求成功 (已从 ${originalSource} 回退至 ${API_CONFIG.fallbackSource} 源)`);
            } catch (fallbackError) {
                // 如果回退尝试也失败，记录错误
                console.error(`Fallback to '${API_CONFIG.fallbackSource}' (API type: ${initialApiParams.types}) failed:`, fallbackError.message);
                // 使用原始主源的错误信息和音源来处理 API 错误（向客户端报告原始尝试的失败）
                handleApiError(ctx, error, originalSource); 
            }
        } else {
            // 如果错误类型不适合回退，或者原始源就是回退源，则直接处理错误
            handleApiError(ctx, error, originalSource);
        }
    }
}

/**
 * 验证 API 请求中的 source 参数是否有效，并使用标准格式返回错误
 * @param {object} ctx - Koa 上下文对象
 * @param {string} sourceFromQuery - 从查询参数中获取的 source 值
 * @returns {boolean} - 如果 source 有效或未提供，则返回 true；否则返回 false 并设置 ctx 响应
 */
function validateApiSource(ctx, sourceFromQuery) {
    // 如果提供了 source 参数，但不在支持的音源列表中
    if (sourceFromQuery && !API_CONFIG.validSources.includes(sourceFromQuery)) {
        const message = `您提供的音源 '${sourceFromQuery}' 不被支持。`; // 错误消息
        const errorData = { // 包含详细信息的 data 对象
            provided: sourceFromQuery, // 用户提供的值
            allowed_sources: API_CONFIG.validSources // 允许的值列表
        };
        setErrorResponse(ctx, message, 400, errorData); // 设置标准错误响应
        return false; // 返回 false 表示验证失败
    }
    return true; // 验证通过
}

/**
 * 验证请求中是否包含必要的参数，并使用标准格式返回错误
 * @param {object} ctx - Koa 上下文对象
 * @param {*} value - 要验证的参数值
 * @param {string} paramName - 参数的名称
 * @param {string} [idAlias=paramName] - 在错误消息中显示的参数别名（例如 'pic_id' 代替 'id'）
 * @returns {boolean} - 如果参数有效，返回 true；否则返回 false 并设置 ctx 响应
 */
function validateRequiredParam(ctx, value, paramName, idAlias = paramName) {
    // 如果参数值不存在 (且不为 0，因为 0 可能是有效ID)
    if (!value && value !== 0) {
        const message = `缺少必要参数 ${idAlias}`; // 错误消息
        const errorData = { required_param: idAlias }; // 包含详细信息的 data 对象
        setErrorResponse(ctx, message, 400, errorData); // 设置标准错误响应
        return false; // 验证失败
    }
    return true; // 验证通过
}

/**
 * 验证参数值是否在允许的枚举值列表中，并使用标准格式返回错误
 * @param {object} ctx - Koa 上下文对象
 * @param {*} value - 要验证的参数值
 * @param {string} paramName - 参数的名称
 * @param {Array<string>} allowedValues - 允许的参数值列表 (字符串形式)
 * @returns {boolean} - 如果参数有效或未提供，返回 true；否则返回 false 并设置 ctx 响应
 */
function validateEnumParam(ctx, value, paramName, allowedValues) {
    // 如果参数值已提供，但不在允许的值列表中 (转换为字符串比较)
    if (value && !allowedValues.includes(String(value))) {
        const message = `无效参数 ${paramName}: '${value}'`; // 错误消息
        const errorData = { // 包含详细信息的 data 对象
            param: paramName, // 参数名
            provided: value, // 用户提供的值
            allowed_values: allowedValues // 允许的值列表
        };
        setErrorResponse(ctx, message, 400, errorData); // 设置标准错误响应
        return false; // 验证失败
    }
    return true; // 验证通过
}

/**
 * 验证参数值是否为正整数，并使用标准格式返回错误
 * @param {object} ctx - Koa 上下文对象
 * @param {*} value - 要验证的参数值
 * @param {string} paramName - 参数的名称
 * @returns {boolean} - 如果参数是正整数，返回 true；否则返回 false 并设置 ctx 响应
 */
function validatePositiveIntParam(ctx, value, paramName) {
    // 将参数值解析为整数
    const num = parseInt(value, 10);
    // 如果解析结果不是数字 (NaN) 或数字小于等于 0
    if (isNaN(num) || num <= 0) {
        const message = `参数 ${paramName} ('${value}') 必须是正整数`; // 错误消息
        const errorData = { // 包含详细信息的 data 对象
            param: paramName, // 参数名
            provided: value, // 用户提供的值
            requirement: "正整数" // 要求
        };
        setErrorResponse(ctx, message, 400, errorData); // 设置标准错误响应
        return false; // 验证失败
    }
    return true; // 验证通过
}

/**
 * 清理并选择性暴露 @unblockneteasemusic/server 的 match() 函数结果。
 * @param {object} matchResult - match() 函数的原始返回结果
 * @returns {object | null} - 清理后的、适合客户端的数据对象，或在结果无效时返回 null
 */
function sanitizeUnmResult(matchResult) { 
    // 检查 matchResult 是否为有效对象且包含 URL
    if (typeof matchResult !== 'object' || matchResult === null || !matchResult.url) {
        console.warn('Invalid or incomplete result from match:', matchResult); // 记录无效结果的警告
        return null; // 返回 null 表示结果无效
    }
    // 返回一个只包含客户端所需安全字段的对象
    return {
        url: matchResult.url, // 音乐 URL
        br: matchResult.br, // 比特率
        size: matchResult.size, // 文件大小
        type: matchResult.type || matchResult.format, // 文件类型 (兼容 type 或 format 字段)
        md5: matchResult.md5, // MD5 哈希值 (可能存在)
        // 新增：尝试从 matchResult 中获取音源信息。
        // 此字段的可用性取决于 @unblockneteasemusic/server 的 match() 函数是否在其结果中提供 'source' 属性。
        source: matchResult.source 
    };
}

// 创建一个新的 Koa Router 实例
const router = new Router();

// 定义根路径 ("/") 的 GET 请求处理器，返回 API 欢迎信息和基本状态
router.get("/", async (ctx) => {
    // 构建要在 data 字段中返回的欢迎信息对象
    const welcomeData = {
        greeting: "Welcome to the Music API!", // 欢迎语
        version: packageJson.version, // 从 package.json 获取的项目版本
        documentation_url: "/public/api-docs.html", // 指向 API 文档的路径 (假设存在)
        status: "API Service is running" // API 运行状态
    };
    // 使用 setSuccessResponse 设置标准成功响应
    setSuccessResponse(ctx, welcomeData, "API 服务运行中");
});

// 定义 "/info" 路径的 GET 请求处理器，返回 API 的详细配置和状态信息
router.get("/info", async (ctx) => {
    try {
        // 构建要在 data 字段中返回的 API 信息对象
        const infoPayload = {
            version: packageJson.version, // 项目版本
            proxy_enabled: !!PROXY_URL_ENV, // 代理是否启用
            enable_flac: process.env.ENABLE_FLAC === 'true', // 是否启用 FLAC
            select_max_br: process.env.SELECT_MAX_BR === 'true', // 是否选择最大比特率
            follow_source_order: process.env.FOLLOW_SOURCE_ORDER === 'true', // 是否遵循音源顺序
            gd_api_default_source: API_CONFIG.defaultSource, // GDStudio API 的默认音源
            gd_api_fallback_source: API_CONFIG.fallbackSource, // GDStudio API 的回退音源
            gd_api_valid_sources: API_CONFIG.validSources, // GDStudio API 支持的音源列表
            cache_enabled: cacheService.CACHE_ENABLED, // 缓存是否启用
            cache_default_ttl_seconds: cacheService.DEFAULT_TTL_SECONDS, // 缓存的默认 TTL (秒)
        };
        // 使用 setSuccessResponse 设置标准成功响应
        setSuccessResponse(ctx, infoPayload, "API 信息获取成功");
    } catch (error) {
        // 捕获此路由处理器内部可能发生的任何意外错误 (例如 packageJson 未加载等)
        console.error("Critical error in /info route handler:", error);
        // 使用 setErrorResponse 设置标准错误响应
        setErrorResponse(ctx, "获取API信息时发生内部服务器错误。", 500, null);
    }
});

// --- @unblockneteasemusic/server 相关路由 ---

// 定义 "/test" 路径的 GET 请求处理器，用于测试 UNM 的 match 功能
router.get("/test", async (ctx) => {
    // 在非生产环境记录路由开始处理的日志
    if (process.env.NODE_ENV !== 'production') {
        console.log(`[${new Date().toISOString()}] /test route started for ID ${UNM_SETTINGS.testSongId}`);
    }
    // 获取要尝试的音源列表
    const sourcesToTry = UNM_SETTINGS.defaultSources;
    // 构建用于缓存键的参数对象
    const testCacheKeyParams = { id: UNM_SETTINGS.testSongId, sources: sourcesToTry.join(',') };
    // 生成缓存键
    const testCacheKey = cacheService.generateCacheKey('unm:test', testCacheKeyParams);

    // 如果缓存启用且缓存键有效
    if (cacheService.CACHE_ENABLED && testCacheKey) {
        // 尝试从缓存获取数据
        const cachedClientData = cacheService.get(testCacheKey);
        // 如果缓存命中
        if (cachedClientData !== undefined) {
            // 在非生产环境记录缓存命中日志
            if (process.env.NODE_ENV !== 'production') {
                console.log(`[Cache HIT] Serving /test from cache for key: ${testCacheKey}`);
            }
            // 使用 setSuccessResponse 设置标准成功响应
            setSuccessResponse(ctx, cachedClientData, "获取成功 (from cache)");
            return; // 直接返回
        }
    }
    
    // 在非生产环境记录将要尝试的音源
    if (process.env.NODE_ENV !== 'production') {
        console.log(`[${new Date().toISOString()}] Attempting to match with sources: ${sourcesToTry.join(', ')}`);
    }
    // 记录开始调用的时间戳
    const startTime = Date.now();
    try {
        // 调用 UNM 的 match 函数获取原始数据
        const rawData = await match(UNM_SETTINGS.testSongId, sourcesToTry);
        // 清理原始数据，提取客户端所需字段 (包含 source)
        const clientData = sanitizeUnmResult(rawData);
        // 计算 match 函数执行耗时
        const duration = Date.now() - startTime;
        // 在非生产环境记录执行耗时
        if (process.env.NODE_ENV !== 'production') {
            console.log(`[${new Date().toISOString()}] match() completed in ${duration}ms.`);
        }

        // 如果清理后的数据无效
        if (!clientData) {
            setErrorResponse(ctx, "未能从音源获取有效信息。", 404, null); // 使用标准错误响应
            return; // 返回
        }
        
        // 如果缓存启用、缓存键有效且处理后的数据存在
        if (cacheService.CACHE_ENABLED && testCacheKey && clientData) {
            cacheService.set(testCacheKey, clientData); // 将数据存入缓存
        }
        // 使用 setSuccessResponse 设置标准成功响应
        setSuccessResponse(ctx, clientData, "获取成功");
    } catch (error) {
        // 计算发生错误时的执行耗时
        const duration = Date.now() - startTime;
        // 在服务端记录完整的错误信息
        console.error(`[${new Date().toISOString()}] Error in /test route for match after ${duration}ms:`, error.message);
        // 使用 setErrorResponse 设置标准错误响应
        setErrorResponse(ctx, "测试接口处理时发生内部错误。", 500, null);
    }
});

// 定义 "/match" 路径的 GET 请求处理器，用于根据 ID 和指定音源匹配歌曲
router.get("/match", async (ctx) => {
    try {
        // 从查询参数中获取歌曲 ID
        const id = ctx.request.query.id;
        // 验证 ID 是否提供
        if (!validateRequiredParam(ctx, id, 'id')) return; // 如果验证失败，函数内部已调用 setErrorResponse

        // 从查询参数中获取要尝试的音源列表 (逗号分隔)，若未提供则使用 UNM 默认音源
        const serverSources = ctx.request.query.server
            ? ctx.request.query.server.split(",")
            : UNM_SETTINGS.defaultSources;

        // 构建用于缓存键的参数对象
        const matchCacheKeyParams = { id, sources: serverSources.join(',') };
        // 生成缓存键
        const matchCacheKey = cacheService.generateCacheKey('unm:match', matchCacheKeyParams);

        // 如果缓存启用且缓存键有效
        if (cacheService.CACHE_ENABLED && matchCacheKey) {
            // 尝试从缓存获取数据
            const cachedClientData = cacheService.get(matchCacheKey);
            // 如果缓存命中
            if (cachedClientData !== undefined) {
                // 在非生产环境记录缓存命中日志
                if (process.env.NODE_ENV !== 'production') {
                    console.log(`[Cache HIT] Serving /match from cache for key: ${matchCacheKey}`);
                }
                // 重要：克隆缓存数据以防后续修改（如添加 proxyUrl）影响缓存中的原始对象
                let clientDataForResponse = JSON.parse(JSON.stringify(cachedClientData)); 
                
                // 如果配置了代理 URL，且响应数据中有 URL，且 URL 包含 "kuwo" (特定代理逻辑)
                if (PROXY_URL_ENV && clientDataForResponse.url && clientDataForResponse.url.includes("kuwo")) {
                    // 生成并添加代理 URL
                    clientDataForResponse.proxyUrl = PROXY_URL_ENV + clientDataForResponse.url.replace(/^http:\/\//, "http/");
                }
                // 使用 setSuccessResponse 设置标准成功响应
                setSuccessResponse(ctx, clientDataForResponse, "匹配成功 (from cache)");
                return; // 直接返回
            }
        }

        // 在非生产环境记录开始匹配的 ID 和音源
        if (process.env.NODE_ENV !== 'production') {
            console.log(`Attempting to match ID '${id}' using sources: ${serverSources.join(',')}`);
        }
        // 调用 UNM 的 match 函数
        const rawData = await match(id, serverSources);
        // 清理原始数据 (包含 source)
        const clientData = sanitizeUnmResult(rawData);

        // 如果清理后的数据无效
        if (!clientData) {
            setErrorResponse(ctx, "未能从音源获取有效信息。", 404, null); // 使用标准错误响应
            return; // 返回
        }
        
        // 如果缓存启用、缓存键有效且处理后的数据存在
        // 注意：缓存的是未经代理修改的 clientData
        if (cacheService.CACHE_ENABLED && matchCacheKey && clientData) {
            cacheService.set(matchCacheKey, clientData); // 将数据存入缓存
        }
        
        // 克隆 clientData 以便进行可能的代理修改，而不影响原始 clientData
        let clientDataForResponse = JSON.parse(JSON.stringify(clientData));
        // 应用特定代理逻辑 (同缓存命中部分)
        if (PROXY_URL_ENV && clientDataForResponse.url && clientDataForResponse.url.includes("kuwo")) {
            clientDataForResponse.proxyUrl = PROXY_URL_ENV + clientDataForResponse.url.replace(/^http:\/\//, "http/");
        }
        // 使用 setSuccessResponse 设置标准成功响应
        setSuccessResponse(ctx, clientDataForResponse, "匹配成功");
    } catch (error) {
        // 在服务端记录错误信息
        console.error("Error during /match:", error.message); 
        // 在非生产环境打印堆栈信息
        if (process.env.NODE_ENV !== 'production' && error.stack) {
            console.error(error.stack);
        }
        // 使用 setErrorResponse 设置标准错误响应
        setErrorResponse(ctx, "匹配时发生内部错误。", 500, null);
    }
});

// --- GDStudio API 路由 ---
// 这些路由通过调用 performApiCallWithFallback 来处理请求，该函数内部已使用 setSuccessResponse 和 handleApiError (进而使用 setErrorResponse)
// 因此它们会自动遵循统一的响应格式。

// 定义 "/url" 路径的 GET 请求处理器，获取歌曲播放链接
router.get("/url", async (ctx) => {
    // 验证 source 参数
    if (!validateApiSource(ctx, ctx.request.query.source)) return;
    // 从查询参数解构获取 id 和 br (比特率，默认为 '999')
    const { id, br = '999' } = ctx.request.query;
    // 获取音源，若未提供则使用默认音源
    const source = ctx.request.query.source || API_CONFIG.defaultSource;
    // 验证 id 是否提供
    if (!validateRequiredParam(ctx, id, 'id')) return;
    // 验证 br 参数是否在允许的枚举值内
    if (!validateEnumParam(ctx, br, 'br', ["128", "192", "320", "740", "999"])) return;

    // 构建初始 API 请求参数对象
    const initialApiParams = { types: "url", id, source, br }; 
    // 定义处理 API 结果的函数
    const processDataFn = (apiResult, currentSourceParam, query) => ({
        id: apiResult.id || query.id, // 使用 API 返回的 ID，或原始查询的 ID 作为备用
        br: apiResult.br, // 比特率
        size: apiResult.size, // 文件大小
        url: apiResult.url, // 歌曲 URL
        // 'source' 字段将由 performApiCallWithFallback 在缓存前添加
    });
    // 调用包含缓存和回退逻辑的 API 调用函数，applyProxy 设置为 true
    await performApiCallWithFallback(ctx, initialApiParams, processDataFn, ctx.request.query, true);
});

// 定义 "/search" 路径的 GET 请求处理器，搜索歌曲
router.get("/search", async (ctx) => {
    // 验证 source 参数
    if (!validateApiSource(ctx, ctx.request.query.source)) return;
    // 从查询参数解构获取 name, count (数量，默认为 '20'), pages (页码，默认为 '1')
    const { name, count = '20', pages = '1' } = ctx.request.query;
    // 获取音源
    const source = ctx.request.query.source || API_CONFIG.defaultSource;
    // 验证 name 是否提供
    if (!validateRequiredParam(ctx, name, 'name')) return;
    // 验证 count 是否为正整数
    if (!validatePositiveIntParam(ctx, count, 'count')) return;
    // 验证 pages 是否为正整数
    if (!validatePositiveIntParam(ctx, pages, 'pages')) return;

    // 构建初始 API 请求参数
    const initialApiParams = { types: "search", name, source, count, pages };
    // 定义处理 API 搜索结果的函数
    const processDataFn = (apiResult, currentSourceParam) => ( 
        Array.isArray(apiResult) ? apiResult.map(item => ({ // 如果 API 结果是数组
            id: item.id, // 歌曲 ID
            name: item.name, // 歌曲名
            artist: item.artist, // 歌手
            album: item.album, // 专辑
            pic_id: item.pic_id, // 封面图片 ID (若有)
            lyric_id: item.lyric_id, // 歌词 ID (若有)
            // 'source' 字段将由 performApiCallWithFallback 在缓存前添加
        })) : [] // 如果 API 结果不是数组，返回空数组
    );
    // 调用 API 调用函数，applyProxy 设置为 false (搜索结果一般不直接代理)
    await performApiCallWithFallback(ctx, initialApiParams, processDataFn, ctx.request.query, false);
});

// 定义 "/pic" 路径的 GET 请求处理器，获取歌曲封面图片链接
router.get("/pic", async (ctx) => {
    // 验证 source 参数
    if (!validateApiSource(ctx, ctx.request.query.source)) return;
    // 从查询参数解构获取 id (图片ID) 和 size (尺寸，默认为 '300')
    const { id, size = '300' } = ctx.request.query;
    // 获取音源
    const source = ctx.request.query.source || API_CONFIG.defaultSource;
    // 验证 id (此处别名为 'pic_id') 是否提供
    if (!validateRequiredParam(ctx, id, 'id', 'pic_id')) return;
    // 验证 size 是否在允许的枚举值内
    if (!validateEnumParam(ctx, size, 'size', ["300", "500"])) return;

    // 构建初始 API 请求参数
    const initialApiParams = { types: "pic", id, source, size };
    // 定义处理 API 图片结果的函数
    const processDataFn = (apiResult, currentSourceParam) => ({ 
        url: apiResult.url, // 图片 URL
        // 'source' 字段将由 performApiCallWithFallback 在缓存前添加
    });
    // 调用 API 调用函数，applyProxy 设置为 false
    await performApiCallWithFallback(ctx, initialApiParams, processDataFn, ctx.request.query, false);
});

// 定义 "/lyric" 路径的 GET 请求处理器，获取歌词
router.get("/lyric", async (ctx) => {
    // 验证 source 参数
    if (!validateApiSource(ctx, ctx.request.query.source)) return;
    // 从查询参数解构获取 id (歌词ID)
    const { id } = ctx.request.query;
    // 获取音源
    const source = ctx.request.query.source || API_CONFIG.defaultSource;
    // 验证 id (此处别名为 'lyric_id') 是否提供
    if (!validateRequiredParam(ctx, id, 'id', 'lyric_id')) return;

    // 构建初始 API 请求参数
    const initialApiParams = { types: "lyric", id, source };
    // 定义处理 API 歌词结果的函数
    const processDataFn = (apiResult, currentSourceParam) => ({ 
        lyric: apiResult.lyric, // 原文歌词
        tlyric: apiResult.tlyric, // 翻译歌词 (可能不存在)
        // 'source' 字段将由 performApiCallWithFallback 在缓存前添加
    });
    // 调用 API 调用函数，applyProxy 设置为 false
    await performApiCallWithFallback(ctx, initialApiParams, processDataFn, ctx.request.query, false);
});


// --- 404 处理中间件 ---
// 此中间件将在没有其他路由匹配请求时执行
router.use(async (ctx) => { 
    // 根据客户端接受的内容类型 (Accept header) 返回不同格式的 404 响应
    if (ctx.accepts('html')) { // 如果客户端接受 HTML
        try {
            ctx.status = 404; // 设置 HTTP 状态码为 404 Not Found
            ctx.type = 'html'; // 设置响应类型为 HTML
            ctx.body = '<h1>404 Not Found</h1><p>The page you are looking for does not exist.</p>'; // 返回简单的 HTML 页面
        } catch (renderError) {
            // 如果渲染 HTML 页面失败，记录错误并回退到 JSON 响应
            console.error("Error rendering 404 HTML page, falling back to JSON:", renderError.message);
            // 使用 setErrorResponse 设置标准错误响应，指明内部渲染问题
            setErrorResponse(ctx, "请求的资源未找到 (HTML 渲染失败)", 500, { internal_error_details: "HTML_PAGE_RENDER_FAILED" });
        }
    } else { // 如果客户端不接受 HTML (或接受其他如 JSON)
        // 使用 setErrorResponse 设置标准 404 JSON 响应
        setErrorResponse(ctx, "请求的资源未找到。", 404, null); 
    }
});

// 导出配置好的 Koa Router 实例，供主应用文件 (如 index.js) 使用
module.exports = router;
