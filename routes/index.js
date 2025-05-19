// 引入 Koa Router 模块，用于创建路由
const Router = require("koa-router");
// 引入 @unblockneteasemusic/server 模块，用于匹配和获取音乐链接
const match = require("@unblockneteasemusic/server");
// 引入 package.json 文件，用于获取项目版本等信息（假设它在上一级目录）
const packageJson = require("../package.json");

// --- 配置中心 ---
const API_CONFIG = {
    baseUrl: "https://music-api.gdstudio.xyz/api.php",
    defaultSource: 'netease', // GDStudio API 默认音源 (根据文档)
    // GDStudio API 支持的有效音源列表 (基于 2025-4-26 文档)
    validSources: [
        'netease', 'tencent', 'tidal', 'spotify', 'ytmusic',
        'qobuz', 'joox', 'deezer', 'migu', 'kugou', 'kuwo', 'ximalaya'
    ],
    // 用于 GDStudio API 调用的回退音源 (用户最新代码指定为 'kugou')
    fallbackSource: 'kugou',
    requestTimeout: 10000, // API 请求超时时间 (毫秒)
};

const UNM_API_CONFIG = { // @unblockneteasemusic/server 相关配置
    // /test 和 /match 路由的默认音源列表 (与 GDStudio API 的 source 参数独立)
    defaultSources: ["pyncmd", "kuwo", "bilibili", "migu", "kugou", "qq", "youtube", "youtube-dl", "yt-dlp"],
    testSongId: 416892104, // /test 路由使用的测试歌曲 ID
};

const PROXY_URL_ENV = process.env.PROXY_URL; // 从环境变量读取代理 URL

// --- 工具函数 ---

/**
 * 异步调用 GDStudio API
 * @param {object} params - API 请求参数对象
 * @returns {Promise<object>} - API 返回的 JSON 数据
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
        console.log(`Workspaceing from upstream API: ${apiUrl.toString()}`);
        const response = await fetch(apiUrl.toString(), { signal: controller.signal });
        clearTimeout(timeoutId);

        if (!response.ok) {
            console.warn(`Upstream API request failed! URL: ${apiUrl.toString()}, Status: ${response.status}, StatusText: ${response.statusText}`);
            let errorBody = null;
            try {
                const textBody = await response.text();
                console.warn(`Upstream API response body (text): ${textBody}`);
                errorBody = JSON.parse(textBody);
            } catch (e) {
                console.warn(`Failed to parse upstream API response body as JSON: ${e.message}`);
            }
            throw new Error(`API request failed with status ${response.status}. Response: ${JSON.stringify(errorBody) || response.statusText}`);
        }
        return await response.json();
    } catch (error) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
            console.error(`Upstream API request timed out: ${apiUrl.toString()}`);
            throw new Error('API request timed out');
        }
        console.error(`Error during fetchApiData for [${apiUrl.toString()}]:`, error);
        throw error;
    }
}

/**
 * 标准化处理 API 错误并设置 Koa 上下文响应
 * @param {object} ctx - Koa 上下文对象
 * @param {Error} error - 捕获到的错误对象
 * @param {string} requestedSource - 原始请求的音源
 */
function handleApiError(ctx, error, requestedSource = API_CONFIG.defaultSource) {
    console.error(`${ctx.path} 请求失败 (源: ${requestedSource}):`, error.message);
    if (error.stack && process.env.NODE_ENV !== 'production') {
        console.error(error.stack);
    }

    let statusCode = 500;
    let message = "服务器内部错误";
    const sourceText = requestedSource === API_CONFIG.defaultSource ? '默认源' : `'${requestedSource}'`;

    if (error.message === 'API request timed out') {
        statusCode = 504;
        message = `请求上游 API (${sourceText}) 超时，请稍后重试。`;
    } else if (error.message.includes("API request failed")) {
        const matchStatus = error.message.match(/status (\d+)/);
        const upstreamStatusCode = matchStatus ? parseInt(matchStatus[1], 10) : 502;
        statusCode = (upstreamStatusCode >= 100 && upstreamStatusCode <= 599) ? upstreamStatusCode : 502;
        message = `请求上游源 ${sourceText} 失败 (状态码: ${statusCode})。该源可能暂时不可用，请尝试更换 source 参数或稍后再试。`;
    }

    ctx.status = statusCode;
    ctx.body = { code: ctx.status, message: message };
}

/**
 * 如果适用，为音乐链接应用代理
 * @param {string} url - 原始音乐链接
 * @param {string} [proxyBaseUrl=PROXY_URL_ENV] - 代理服务器基础 URL
 * @returns {string | null} - 代理后的 URL，如果应用了代理；否则返回 null
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
 * 执行 API 调用，并在失败时尝试回退到备用音源
 * @param {object} ctx - Koa 上下文
 * @param {object} initialApiParams - 首次尝试的 API 参数 (包含 types, source, id/name 等)
 * @param {function} processDataFn - 处理 API 返回数据的函数 (apiResult, source, queryParams) => processedData
 * @param {object} originalQueryParams - 原始的 ctx.request.query, 用于 processDataFn
 * @param {boolean} [applyProxy=false] - 是否为结果中的 url 应用代理逻辑
 */
async function performApiCallWithFallback(ctx, initialApiParams, processDataFn, originalQueryParams, applyProxy = false) {
    const originalSource = initialApiParams.source;
    try {
        const result = await fetchApiData(initialApiParams);
        let responseData = processDataFn(result, originalSource, originalQueryParams);

        if (applyProxy && responseData.url) {
            const proxiedUrl = generateProxyUrl(responseData.url);
            if (proxiedUrl) responseData.proxyUrl = proxiedUrl;
        }
        ctx.body = { code: 200, message: `请求成功 (源: ${originalSource})`, data: responseData };
    } catch (error) {
        if ((error.message.includes("API request failed") || error.message === 'API request timed out') &&
            originalSource !== API_CONFIG.fallbackSource) {
            console.warn(`源 '${originalSource}' (API 类型: ${initialApiParams.types}) 请求失败. 尝试回退至 '${API_CONFIG.fallbackSource}'...`);
            try {
                const fallbackApiParams = { ...initialApiParams, source: API_CONFIG.fallbackSource };
                const fallbackResult = await fetchApiData(fallbackApiParams);
                let responseData = processDataFn(fallbackResult, API_CONFIG.fallbackSource, originalQueryParams);

                if (applyProxy && responseData.url) {
                    const proxiedUrl = generateProxyUrl(responseData.url);
                    if (proxiedUrl) responseData.proxyUrl = proxiedUrl;
                }
                console.log(`API 类型 '${initialApiParams.types}' 从 '${API_CONFIG.fallbackSource}' 回退成功. ID/Name: ${initialApiParams.id || initialApiParams.name || 'N/A'}`);
                ctx.body = { code: 200, message: `请求成功 (已从 ${originalSource} 回退至 ${API_CONFIG.fallbackSource} 源)`, data: responseData };
            } catch (fallbackError) {
                console.error(`回退至 '${API_CONFIG.fallbackSource}' (API 类型: ${initialApiParams.types}) 尝试失败:`, fallbackError.message);
                handleApiError(ctx, error, originalSource); // 传递原始错误
            }
        } else {
            handleApiError(ctx, error, originalSource);
        }
    }
}

// --- 参数校验工具 ---
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

function validateRequiredParam(ctx, value, paramName, idAlias = paramName) {
    if (!value) {
        ctx.status = 400;
        ctx.body = { code: 400, message: `缺少必要参数 ${idAlias}` };
        return false;
    }
    return true;
}

function validateEnumParam(ctx, value, paramName, allowedValues) {
    if (value && !allowedValues.includes(String(value))) { // Ensure value is string for comparison if needed
        ctx.status = 400;
        ctx.body = { code: 400, message: `无效参数 ${paramName}: '${value}'`, allowed_values: allowedValues };
        return false;
    }
    return true;
}

function validatePositiveIntParam(ctx, value, paramName) {
    const num = parseInt(value, 10);
    if (isNaN(num) || num <= 0) {
        ctx.status = 400;
        ctx.body = { code: 400, message: `参数 ${paramName} ('${value}') 必须是正整数` };
        return false;
    }
    return true;
}


// --- Router 实例 ---
const router = new Router();

// --- 基础路由 ---
router.get("/", async (ctx) => {
    await ctx.render("index"); // 确保 koa-views 正确配置
});

router.get("/info", async (ctx) => {
    ctx.body = {
        code: 200,
        version: packageJson.version,
        enable_flac: process.env.ENABLE_FLAC === 'true',
        gd_api_default_source: API_CONFIG.defaultSource,
        gd_api_fallback_source: API_CONFIG.fallbackSource,
        gd_api_valid_sources: API_CONFIG.validSources,
    };
});

// --- @unblockneteasemusic/server 相关路由 ---
router.get("/test", async (ctx) => {
    console.log(`[${new Date().toISOString()}] /test route started for ID ${UNM_API_CONFIG.testSongId}`);
    const sourcesToTry = UNM_API_CONFIG.defaultSources; // Using the same default list as /match for consistency based on user code
    console.log(`[${new Date().toISOString()}] Attempting to match with @unblockneteasemusic/server sources: ${sourcesToTry.join(', ')}`);
    const startTime = Date.now();
    try {
        const data = await match(UNM_API_CONFIG.testSongId, sourcesToTry);
        const duration = Date.now() - startTime;
        console.log(`[${new Date().toISOString()}] @unblockneteasemusic/server match() completed in ${duration}ms.`);
        ctx.body = { code: 200, message: "获取成功 (@unblockneteasemusic/server)", data };
    } catch (error) {
        const duration = Date.now() - startTime;
        console.error(`[${new Date().toISOString()}] Error in /test route for @unblockneteasemusic/server after ${duration}ms:`, error);
        ctx.status = 500;
        ctx.body = { code: 500, message: "(@unblockneteasemusic/server) 测试接口处理失败", error: error.message };
    }
});

router.get("/match", async (ctx) => {
    try {
        const id = ctx.request.query.id;
        if (!validateRequiredParam(ctx, id, 'id')) return;

        const serverSources = ctx.request.query.server
            ? ctx.request.query.server.split(",")
            : UNM_API_CONFIG.defaultSources;

        console.log(`@unblockneteasemusic/server: 开始匹配 ID '${id}' 使用源: ${serverSources.join(',')}`);
        const data = await match(id, serverSources);

        if (PROXY_URL_ENV && data.url && data.url.includes("kuwo")) { // 原有代理逻辑
            data.proxyUrl = PROXY_URL_ENV + data.url.replace(/^http:\/\//, "http/");
        }
        ctx.body = { code: 200, message: "匹配成功 (@unblockneteasemusic/server)", data };
    } catch (error) {
        console.error("@unblockneteasemusic/server 匹配出现错误:", error);
        ctx.status = 500;
        ctx.body = { code: 500, message: "(@unblockneteasemusic/server) 匹配失败" };
    }
});

// --- GDStudio API 路由 ---

// 获取歌曲播放链接
router.get("/url", async (ctx) => {
    if (!validateApiSource(ctx, ctx.request.query.source)) return;

    const { id, br = '999' } = ctx.request.query; // br 默认 '999'
    const source = ctx.request.query.source || API_CONFIG.defaultSource;

    if (!validateRequiredParam(ctx, id, 'id')) return;
    if (!validateEnumParam(ctx, br, 'br', ["128", "192", "320", "740", "999"])) return;

    const initialApiParams = { types: "url", id, source, br };
    const processDataFn = (apiResult, currentSource, query) => ({
        id: apiResult.id || query.id, // 使用原始请求的 id 作为后备
        source: currentSource,
        br: apiResult.br,
        size: apiResult.size,
        url: apiResult.url,
    });

    await performApiCallWithFallback(ctx, initialApiParams, processDataFn, ctx.request.query, true);
});

// 搜索音乐
router.get("/search", async (ctx) => {
    if (!validateApiSource(ctx, ctx.request.query.source)) return;

    const { name, count = '20', pages = '1' } = ctx.request.query;
    const source = ctx.request.query.source || API_CONFIG.defaultSource;

    if (!validateRequiredParam(ctx, name, 'name')) return;
    if (!validatePositiveIntParam(ctx, count, 'count')) return;
    if (!validatePositiveIntParam(ctx, pages, 'pages')) return;

    const initialApiParams = { types: "search", name, source, count, pages };
    const processDataFn = (apiResult, currentSource) => {
        return Array.isArray(apiResult) ? apiResult.map(item => ({ ...item, source: currentSource })) : [];
    };
    
    await performApiCallWithFallback(ctx, initialApiParams, processDataFn, ctx.request.query, false);
});

// 获取专辑图
router.get("/pic", async (ctx) => {
    if (!validateApiSource(ctx, ctx.request.query.source)) return;

    const { id, size = '300' } = ctx.request.query;
    const source = ctx.request.query.source || API_CONFIG.defaultSource;

    if (!validateRequiredParam(ctx, id, 'id', 'pic_id')) return;
    if (!validateEnumParam(ctx, size, 'size', ["300", "500"])) return;

    const initialApiParams = { types: "pic", id, source, size };
    const processDataFn = (apiResult, currentSource) => ({
        ...apiResult,
        source: currentSource, // API 可能不返回 source, 手动添加
    });

    await performApiCallWithFallback(ctx, initialApiParams, processDataFn, ctx.request.query, false);
});

// 获取歌词
router.get("/lyric", async (ctx) => {
    if (!validateApiSource(ctx, ctx.request.query.source)) return;
        
    const { id } = ctx.request.query;
    const source = ctx.request.query.source || API_CONFIG.defaultSource;

    if (!validateRequiredParam(ctx, id, 'id', 'lyric_id')) return;

    const initialApiParams = { types: "lyric", id, source };
    const processDataFn = (apiResult, currentSource) => ({
        ...apiResult,
        source: currentSource, // API 可能不返回 source, 手动添加
    });

    await performApiCallWithFallback(ctx, initialApiParams, processDataFn, ctx.request.query, false);
});


// --- 404 处理中间件 ---
router.use(async (ctx) => {
    ctx.status = 404;
    if (ctx.accepts('html')) {
        try {
            await ctx.render("404"); // 确保 public/404.html 和 koa-views 配置
        } catch (renderError) {
            console.error("渲染 404 HTML 页面失败, 回退到 JSON 响应:", renderError);
            ctx.type = 'json'; // 明确设置类型
            ctx.body = { code: 404, message: '资源未找到 (HTML 渲染失败)' };
        }
    } else {
        ctx.body = { code: 404, message: '资源未找到' };
    }
});

// 导出配置好的 router 实例
module.exports = router;
