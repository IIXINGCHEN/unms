// 引入 Koa Router 模块，用于创建路由
const Router = require("koa-router");
// 引入 @unblockneteasemusic/server 模块，用于匹配和获取音乐链接
const match = require("@unblockneteasemusic/server");

// 引入 package.json 文件。
// 注意：此路径 "./package.json" 假设 router.js 与 package.json 在项目的同一根目录下。
// 如果 router.js 在子目录（如 /api 或 /routes），请将其调整为 "../package.json" 或正确的相对路径。
const packageJson = require("../package.json");

// 引入自定义的缓存服务模块
const cacheService = require('./cacheService'); // 假设 cacheService.js 与 router.js 在同一目录

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
    const apiUrl = new URL(API_CONFIG.baseUrl);
    Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
            apiUrl.searchParams.append(key, value);
        }
    });

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), API_CONFIG.requestTimeout);

    try {
        // 在生产环境，详细的请求日志可能需要根据策略调整或使用专业日志库
        if (process.env.NODE_ENV !== 'production') {
            console.log(`Workspaceing from upstream API: ${apiUrl.toString()}`);
        }
        const response = await fetch(apiUrl.toString(), { signal: controller.signal });
        clearTimeout(timeoutId);

        if (!response.ok) {
            console.warn(`Upstream API request failed! URL: ${apiUrl.toString()}, Status: ${response.status}, StatusText: ${response.statusText}`);
            let errorBodyText = ""; // 用于记录原始文本，以防JSON解析失败
            try {
                errorBodyText = await response.text();
                if (process.env.NODE_ENV !== 'production') { // 不在生产环境暴露过多细节
                    console.warn(`Upstream API response body (text): ${errorBodyText}`);
                }
                JSON.parse(errorBodyText); // 尝试解析以确认是否为有效JSON，但不直接使用其内容抛错
            } catch (e) {
                console.warn(`Failed to parse upstream API response body as JSON or body was not JSON: ${e.message}. Original text: ${errorBodyText.substring(0, 200)}...`);
            }
            throw new Error(`API request failed with status ${response.status}.`);
        }
        return await response.json();
    } catch (error) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
            console.error(`Upstream API request timed out: ${apiUrl.toString()}`);
            throw new Error('API request timed out');
        }
        console.error(`Error during fetchApiData for [${apiUrl.toString()}]:`, error.message);
        throw error;
    }
}

/**
 * 处理 API 请求过程中的错误，并设置 Koa 上下文 (ctx) 的响应状态和内容
 * @param {object} ctx - Koa 的上下文对象
 * @param {Error} error - 捕获到的错误对象
 * @param {string} [requestedSource=API_CONFIG.defaultSource] - 发生错误的请求所使用的音源
 */
function handleApiError(ctx, error, requestedSource = API_CONFIG.defaultSource) {
    console.error(`Request to ${ctx.path} failed (source: ${requestedSource}):`, error.message);
    // 在非生产环境下，打印错误堆栈信息以便调试 (生产环境应依赖外部日志系统收集堆栈)
    if (process.env.NODE_ENV !== 'production' && error.stack) {
        console.error(error.stack);
    }

    let statusCode = 500;
    let clientMessage = "服务器内部错误，请稍后重试。";
    const sourceText = requestedSource === API_CONFIG.defaultSource ? '默认源' : `'${requestedSource}'`;

    if (error.message === 'API request timed out') {
        statusCode = 504;
        clientMessage = `请求上游 API (${sourceText}) 超时，请稍后重试。`;
    } else if (error.message.includes("API request failed with status")) {
        const matchStatus = error.message.match(/status (\d+)/);
        const upstreamStatusCode = matchStatus ? parseInt(matchStatus[1], 10) : 502;
        statusCode = (upstreamStatusCode >= 100 && upstreamStatusCode <= 599) ? upstreamStatusCode : 502;
        clientMessage = `请求上游源 ${sourceText} 失败 (状态码: ${statusCode})。该源可能暂时不可用。`;
    }

    ctx.status = statusCode;
    ctx.body = { code: ctx.status, message: clientMessage };
}

/**
 * 根据环境变量配置，为特定的音乐源 URL 生成代理 URL
 * @param {string} url - 原始音乐 URL
 * @param {string} [proxyBaseUrl=PROXY_URL_ENV] - 代理服务器的基础 URL，默认为环境变量 PROXY_URL
 * @returns {string | null} - 生成的代理 URL，或在不满足代理条件时返回 null
 */
function generateProxyUrl(url, proxyBaseUrl = PROXY_URL_ENV) {
    if (proxyBaseUrl && url && (url.includes("kuwo.cn") || url.includes("kugou.com"))) {
        const protocol = url.startsWith('https://') ? 'https://' : 'http://';
        const urlWithoutProtocol = url.substring(protocol.length);
        return `${proxyBaseUrl.replace(/\/$/, '')}/${protocol}${urlWithoutProtocol}`;
    }
    return null;
}

/**
 * 执行 API 调用，并在主源失败时尝试回退到备用源，同时集成缓存逻辑
 * @param {object} ctx - Koa 的上下文对象
 * @param {object} initialApiParams - 初始 API 请求的参数对象，包含 types, id, source 等
 * @param {Function} processDataFn - 处理从 API 获取到的原始结果并返回客户端所需格式数据的函数
 * @param {object} originalQueryParams - Koa 请求中的原始查询参数对象 (ctx.request.query)
 * @param {boolean} [applyProxy=false] - 是否对结果中的 URL 应用代理逻辑
 */
async function performApiCallWithFallback(ctx, initialApiParams, processDataFn, originalQueryParams, applyProxy = false) {
    const originalSource = initialApiParams.source;

    const paramsForCacheKey = { ...initialApiParams };
    delete paramsForCacheKey.types; 

    const cachePrefix = `gdstudio:${initialApiParams.types}`;
    const cacheKey = cacheService.generateCacheKey(cachePrefix, paramsForCacheKey);

    if (cacheService.CACHE_ENABLED && cacheKey) {
        const cachedData = cacheService.get(cacheKey);
        if (cachedData !== undefined) {
            if (process.env.NODE_ENV !== 'production') {
                console.log(`[Cache HIT] Serving GDStudio API call from cache for key: ${cacheKey}`);
            }
            let responseData = cachedData; 
            if (applyProxy && responseData.url) {
                const proxiedUrl = generateProxyUrl(responseData.url);
                if (proxiedUrl) responseData.proxyUrl = proxiedUrl;
            }
            const messageSource = responseData.source || originalSource;
            ctx.body = { code: 200, message: `请求成功 (源: ${messageSource}, from cache)`, data: responseData };
            return;
        }
    }

    try {
        const result = await fetchApiData(initialApiParams);
        let responseData = processDataFn(result, originalSource, originalQueryParams);

        if (cacheService.CACHE_ENABLED && cacheKey && responseData) {
            if (typeof responseData === 'object' && responseData !== null && !responseData.source && initialApiParams.source) {
                 if (Array.isArray(responseData)) {
                    responseData.forEach(item => item.source = initialApiParams.source);
                 } else {
                    responseData.source = initialApiParams.source;
                 }
            }
            cacheService.set(cacheKey, responseData);
        }

        if (applyProxy && responseData.url) {
            const proxiedUrl = generateProxyUrl(responseData.url);
            if (proxiedUrl) responseData.proxyUrl = proxiedUrl;
        }
        ctx.body = { code: 200, message: `请求成功 (源: ${originalSource})`, data: responseData };
    } catch (error) {
        if ((error.message.includes("API request failed") || error.message === 'API request timed out') &&
            originalSource !== API_CONFIG.fallbackSource) {
            console.warn(`Source '${originalSource}' (API type: ${initialApiParams.types}) failed. Attempting fallback to '${API_CONFIG.fallbackSource}'...`);
            try {
                const fallbackApiParams = { ...initialApiParams, source: API_CONFIG.fallbackSource };
                const fallbackResult = await fetchApiData(fallbackApiParams);
                let responseData = processDataFn(fallbackResult, API_CONFIG.fallbackSource, originalQueryParams);

                if (cacheService.CACHE_ENABLED && cacheKey && responseData) {
                    if (typeof responseData === 'object' && responseData !== null && !responseData.source) {
                        if (Array.isArray(responseData)) {
                           responseData.forEach(item => item.source = API_CONFIG.fallbackSource);
                        } else {
                           responseData.source = API_CONFIG.fallbackSource;
                        }
                   }
                    cacheService.set(cacheKey, responseData); 
                }
                
                if (applyProxy && responseData.url) {
                    const proxiedUrl = generateProxyUrl(responseData.url);
                    if (proxiedUrl) responseData.proxyUrl = proxiedUrl;
                }
                console.log(`API type '${initialApiParams.types}' successfully retrieved from fallback '${API_CONFIG.fallbackSource}'. ID/Name: ${initialApiParams.id || initialApiParams.name || 'N/A'}`);
                ctx.body = { code: 200, message: `请求成功 (已从 ${originalSource} 回退至 ${API_CONFIG.fallbackSource} 源)`, data: responseData };
            } catch (fallbackError) {
                console.error(`Fallback to '${API_CONFIG.fallbackSource}' (API type: ${initialApiParams.types}) failed:`, fallbackError.message);
                handleApiError(ctx, error, originalSource); 
            }
        } else {
            handleApiError(ctx, error, originalSource);
        }
    }
}

/**
 * 验证 API 请求中的 source 参数是否有效
 * @param {object} ctx - Koa 上下文对象
 * @param {string} sourceFromQuery - 从查询参数中获取的 source 值
 * @returns {boolean} - 如果 source 有效或未提供（将使用默认值），则返回 true；否则返回 false 并设置 ctx 响应
 */
function validateApiSource(ctx, sourceFromQuery) { 
    if (sourceFromQuery && !API_CONFIG.validSources.includes(sourceFromQuery)) {
        ctx.status = 400; 
        ctx.body = { 
            code: 400, message: "无效的音源参数 source",
            details: `您提供的音源 '${sourceFromQuery}' 不被支持。`, allowed_sources: API_CONFIG.validSources
        };
        return false; 
    }
    return true; 
}

/**
 * 验证请求中是否包含必要的参数
 * @param {object} ctx - Koa 上下文对象
 * @param {*} value - 要验证的参数值
 * @param {string} paramName - 参数的名称
 * @param {string} [idAlias=paramName] - 在错误消息中显示的参数别名（例如 'pic_id' 代替 'id'）
 * @returns {boolean} - 如果参数有效，返回 true；否则返回 false 并设置 ctx 响应
 */
function validateRequiredParam(ctx, value, paramName, idAlias = paramName) { 
    if (!value && value !== 0) { // 允许参数值为0的情况
        ctx.status = 400; 
        ctx.body = { code: 400, message: `缺少必要参数 ${idAlias}` }; 
        return false; 
    }
    return true; 
}

/**
 * 验证参数值是否在允许的枚举值列表中
 * @param {object} ctx - Koa 上下文对象
 * @param {*} value - 要验证的参数值
 * @param {string} paramName - 参数的名称
 * @param {Array<string>} allowedValues - 允许的参数值列表 (字符串形式)
 * @returns {boolean} - 如果参数有效或未提供，返回 true；否则返回 false 并设置 ctx 响应
 */
function validateEnumParam(ctx, value, paramName, allowedValues) { 
    if (value && !allowedValues.includes(String(value))) {
        ctx.status = 400; 
        ctx.body = { code: 400, message: `无效参数 ${paramName}: '${value}'`, allowed_values: allowedValues }; 
        return false; 
    }
    return true; 
}

/**
 * 验证参数值是否为正整数
 * @param {object} ctx - Koa 上下文对象
 * @param {*} value - 要验证的参数值
 * @param {string} paramName - 参数的名称
 * @returns {boolean} - 如果参数是正整数，返回 true；否则返回 false 并设置 ctx 响应
 */
function validatePositiveIntParam(ctx, value, paramName) { 
    const num = parseInt(value, 10);
    if (isNaN(num) || num <= 0) {
        ctx.status = 400; 
        ctx.body = { code: 400, message: `参数 ${paramName} ('${value}') 必须是正整数` }; 
        return false; 
    }
    return true; 
}

/**
 * 清理并选择性暴露 @unblockneteasemusic/server 的 match() 函数结果。
 * @param {object} matchResult - match() 函数的原始返回结果
 * @returns {object | null} - 清理后的、适合客户端的数据对象，或在结果无效时返回 null
 */
function sanitizeUnmResult(matchResult) { 
    if (typeof matchResult !== 'object' || matchResult === null || !matchResult.url) {
        console.warn('Invalid or incomplete result from match:', matchResult); 
        return null; 
    }
    return {
        url: matchResult.url, 
        br: matchResult.br, 
        size: matchResult.size, 
        type: matchResult.type || matchResult.format, 
        md5: matchResult.md5, 
    };
}

// 创建一个新的 Koa Router 实例
const router = new Router();

// 定义根路径 ("/") 的 GET 请求处理器
router.get("/", async (ctx) => { 
    ctx.body = "Welcome to the Music API! Refer to documentation for available endpoints.";
});

// 定义 "/info" 路径的 GET 请求处理器，返回 API 的一些基本信息和配置状态
router.get("/info", async (ctx) => {
    try {
        // 确保所有外部依赖（如 packageJson, cacheService）和配置（API_CONFIG）都已正确加载
        // 如果其中任何一个在模块加载时失败，此处理器可能根本不会被正确调用，或者在访问属性时出错
        ctx.body = {
            code: 200, 
            version: packageJson.version, // 从 package.json 获取的项目版本
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
    } catch (error) {
        // 捕获此路由处理器内部可能发生的任何意外错误
        console.error("Critical error in /info route handler:", error);
        ctx.status = 500;
        ctx.body = { code: 500, message: "获取API信息时发生内部服务器错误。" };
    }
});

// --- @unblockneteasemusic/server 相关路由 ---
// 定义 "/test" 路径的 GET 请求处理器，用于测试 UNM 的 match 功能
router.get("/test", async (ctx) => {
    if (process.env.NODE_ENV !== 'production') {
        console.log(`[${new Date().toISOString()}] /test route started for ID ${UNM_SETTINGS.testSongId}`);
    }
    const sourcesToTry = UNM_SETTINGS.defaultSources;
    const testCacheKeyParams = { id: UNM_SETTINGS.testSongId, sources: sourcesToTry.join(',') };
    const testCacheKey = cacheService.generateCacheKey('unm:test', testCacheKeyParams);

    if (cacheService.CACHE_ENABLED && testCacheKey) {
        const cachedClientData = cacheService.get(testCacheKey);
        if (cachedClientData !== undefined) {
            if (process.env.NODE_ENV !== 'production') {
                console.log(`[Cache HIT] Serving /test from cache for key: ${testCacheKey}`);
            }
            ctx.body = { code: 200, message: "获取成功 (from cache)", data: cachedClientData };
            return;
        }
    }
    
    if (process.env.NODE_ENV !== 'production') {
        console.log(`[${new Date().toISOString()}] Attempting to match with sources: ${sourcesToTry.join(', ')}`);
    }
    const startTime = Date.now();
    try {
        const rawData = await match(UNM_SETTINGS.testSongId, sourcesToTry);
        const clientData = sanitizeUnmResult(rawData);
        const duration = Date.now() - startTime;
        if (process.env.NODE_ENV !== 'production') {
            console.log(`[${new Date().toISOString()}] match() completed in ${duration}ms.`);
        }

        if (!clientData) {
            ctx.status = 404; 
            ctx.body = { code: ctx.status, message: "未能从音源获取有效信息。" }; 
            return; 
        }
        
        if (cacheService.CACHE_ENABLED && testCacheKey && clientData) {
            cacheService.set(testCacheKey, clientData);
        }
        ctx.body = { code: 200, message: "获取成功 ", data: clientData };
    } catch (error) {
        const duration = Date.now() - startTime;
        console.error(`[${new Date().toISOString()}] Error in /test route for match after ${duration}ms:`, error.message); 
        ctx.status = 500; 
        ctx.body = { code: 500, message: "测试接口处理时发生内部错误。" };
    }
});

// 定义 "/match" 路径的 GET 请求处理器，用于根据 ID 和指定音源匹配歌曲
router.get("/match", async (ctx) => {
    try {
        const id = ctx.request.query.id;
        if (!validateRequiredParam(ctx, id, 'id')) return;

        const serverSources = ctx.request.query.server
            ? ctx.request.query.server.split(",")
            : UNM_SETTINGS.defaultSources;

        const matchCacheKeyParams = { id, sources: serverSources.join(',') };
        const matchCacheKey = cacheService.generateCacheKey('unm:match', matchCacheKeyParams);

        if (cacheService.CACHE_ENABLED && matchCacheKey) {
            const cachedClientData = cacheService.get(matchCacheKey);
            if (cachedClientData !== undefined) {
                if (process.env.NODE_ENV !== 'production') {
                    console.log(`[Cache HIT] Serving /match from cache for key: ${matchCacheKey}`);
                }
                let clientDataForResponse = JSON.parse(JSON.stringify(cachedClientData)); 
                
                if (PROXY_URL_ENV && clientDataForResponse.url && clientDataForResponse.url.includes("kuwo")) {
                    clientDataForResponse.proxyUrl = PROXY_URL_ENV + clientDataForResponse.url.replace(/^http:\/\//, "http/");
                }
                ctx.body = { code: 200, message: "匹配成功 (from cache)", data: clientDataForResponse };
                return;
            }
        }

        if (process.env.NODE_ENV !== 'production') {
            console.log(`Attempting to match ID '${id}' using sources: ${serverSources.join(',')}`);
        }
        const rawData = await match(id, serverSources);
        const clientData = sanitizeUnmResult(rawData);

        if (!clientData) {
            ctx.status = 404; 
            ctx.body = { code: ctx.status, message: "未能从音源获取有效信息。" }; 
            return; 
        }
        
        if (cacheService.CACHE_ENABLED && matchCacheKey && clientData) {
            cacheService.set(matchCacheKey, clientData);
        }
        
        let clientDataForResponse = JSON.parse(JSON.stringify(clientData)); 
        if (PROXY_URL_ENV && clientDataForResponse.url && clientDataForResponse.url.includes("kuwo")) {
            clientDataForResponse.proxyUrl = PROXY_URL_ENV + clientDataForResponse.url.replace(/^http:\/\//, "http/");
        }
        ctx.body = { code: 200, message: "匹配成功 ", data: clientDataForResponse };
    } catch (error) {
        console.error("Error during /match:", error.message); 
        // 在非生产环境打印堆栈信息
        if (process.env.NODE_ENV !== 'production' && error.stack) {
            console.error(error.stack);
        }
        ctx.status = 500; 
        ctx.body = { code: 500, message: "匹配时发生内部错误。" };
    }
});

// --- GDStudio API 路由 ---
// 定义 "/url" 路径的 GET 请求处理器，获取歌曲播放链接
router.get("/url", async (ctx) => {
    if (!validateApiSource(ctx, ctx.request.query.source)) return;
    const { id, br = '999' } = ctx.request.query;
    const source = ctx.request.query.source || API_CONFIG.defaultSource;
    if (!validateRequiredParam(ctx, id, 'id')) return;
    if (!validateEnumParam(ctx, br, 'br', ["128", "192", "320", "740", "999"])) return;

    const initialApiParams = { types: "url", id, source, br }; 
    const processDataFn = (apiResult, currentSourceParam, query) => ({
        id: apiResult.id || query.id, 
        br: apiResult.br, 
        size: apiResult.size, 
        url: apiResult.url, 
    });
    await performApiCallWithFallback(ctx, initialApiParams, processDataFn, ctx.request.query, true);
});

// 定义 "/search" 路径的 GET 请求处理器，搜索歌曲
router.get("/search", async (ctx) => {
    if (!validateApiSource(ctx, ctx.request.query.source)) return;
    const { name, count = '20', pages = '1' } = ctx.request.query;
    const source = ctx.request.query.source || API_CONFIG.defaultSource;
    if (!validateRequiredParam(ctx, name, 'name')) return;
    if (!validatePositiveIntParam(ctx, count, 'count')) return;
    if (!validatePositiveIntParam(ctx, pages, 'pages')) return;

    const initialApiParams = { types: "search", name, source, count, pages };
    const processDataFn = (apiResult, currentSourceParam) => ( 
        Array.isArray(apiResult) ? apiResult.map(item => ({ 
            id: item.id, 
            name: item.name, 
            artist: item.artist, 
            album: item.album, 
            pic_id: item.pic_id, 
            lyric_id: item.lyric_id, 
        })) : [] 
    );
    await performApiCallWithFallback(ctx, initialApiParams, processDataFn, ctx.request.query, false);
});

// 定义 "/pic" 路径的 GET 请求处理器，获取歌曲封面图片链接
router.get("/pic", async (ctx) => {
    if (!validateApiSource(ctx, ctx.request.query.source)) return;
    const { id, size = '300' } = ctx.request.query;
    const source = ctx.request.query.source || API_CONFIG.defaultSource;
    if (!validateRequiredParam(ctx, id, 'id', 'pic_id')) return;
    if (!validateEnumParam(ctx, size, 'size', ["300", "500"])) return;

    const initialApiParams = { types: "pic", id, source, size };
    const processDataFn = (apiResult, currentSourceParam) => ({ 
        url: apiResult.url, 
    });
    await performApiCallWithFallback(ctx, initialApiParams, processDataFn, ctx.request.query, false);
});

// 定义 "/lyric" 路径的 GET 请求处理器，获取歌词
router.get("/lyric", async (ctx) => {
    if (!validateApiSource(ctx, ctx.request.query.source)) return;
    const { id } = ctx.request.query;
    const source = ctx.request.query.source || API_CONFIG.defaultSource;
    if (!validateRequiredParam(ctx, id, 'id', 'lyric_id')) return;

    const initialApiParams = { types: "lyric", id, source };
    const processDataFn = (apiResult, currentSourceParam) => ({ 
        lyric: apiResult.lyric, 
        tlyric: apiResult.tlyric, 
    });
    await performApiCallWithFallback(ctx, initialApiParams, processDataFn, ctx.request.query, false);
});


// --- 404 处理中间件 ---
// 此中间件将在没有其他路由匹配请求时执行
router.use(async (ctx) => { 
    ctx.status = 404; 
    if (ctx.accepts('html')) { 
        try {
            ctx.type = 'html'; 
            ctx.body = '<h1>404 Not Found</h1><p>The page you are looking for does not exist.</p>'; 
        } catch (renderError) {
            console.error("Error rendering 404 HTML page, falling back to JSON:", renderError.message);
            ctx.type = 'json'; 
            ctx.body = { code: 404, message: 'Resource not found (HTML render failed)' };
        }
    } else { 
        ctx.body = { code: 404, message: 'Resource not found' }; 
    }
});

// 导出配置好的 Koa Router 实例，供主应用文件 (如 index.js) 使用
module.exports = router;
