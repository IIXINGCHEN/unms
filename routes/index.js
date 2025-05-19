// 引入 Koa Router 模块，用于创建路由
const Router = require("koa-router");
// 引入 @unblockneteasemusic/server 模块，用于匹配和获取音乐链接
const match = require("@unblockneteasemusic/server");
// 引入 package.json 文件，用于获取项目版本等信息（假设它在上一级目录）
const packageJson = require("../package.json");

// --- 配置中心 ---

// GDStudio API 相关配置
const API_CONFIG = {
    baseUrl: "https://music-api.gdstudio.xyz/api.php",
    defaultSource: 'netease',
    validSources: [
        'netease', 'tencent', 'tidal', 'spotify', 'ytmusic',
        'qobuz', 'joox', 'deezer', 'migu', 'kugou', 'kuwo', 'ximalaya'
    ],
    fallbackSource: 'kugou',
    requestTimeout: 10000,
};

// @unblockneteasemusic/server 相关配置
const UNM_SETTINGS = {
    defaultSources: ["pyncmd", "kuwo", "bilibili", "migu", "kugou", "qq", "youtube", "youtube-dl", "yt-dlp"],
    testSongId: 416892104,
};

const PROXY_URL_ENV = process.env.PROXY_URL;

// --- 工具函数 ---

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
                const textBody = await response.text(); // 读取文本以供记录
                console.warn(`Upstream API response body (text): ${textBody}`);
                errorBody = JSON.parse(textBody); // 尝试解析为JSON
            } catch (e) {
                // 解析失败也继续，errorBody 将为 null 或 textBody
                console.warn(`Failed to parse upstream API response body as JSON: ${e.message}`);
            }
            // 抛出的错误消息不直接包含 errorBody 以防意外泄露，handleApiError 会处理
            throw new Error(`API request failed with status ${response.status}.`);
        }
        return await response.json();
    } catch (error) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
            console.error(`Upstream API request timed out: ${apiUrl.toString()}`);
            throw new Error('API request timed out');
        }
        // 记录原始错误，但抛出时可能不包含所有细节
        console.error(`Error during fetchApiData for [${apiUrl.toString()}]:`, error.message);
        throw error; // handleApiError 会处理这个错误
    }
}

function handleApiError(ctx, error, requestedSource = API_CONFIG.defaultSource) {
    console.error(`${ctx.path} 请求失败 (源: ${requestedSource}):`, error.message);
    if (error.stack && process.env.NODE_ENV !== 'production') {
        console.error(error.stack);
    }

    let statusCode = 500;
    let clientMessage = "服务器内部错误，请稍后重试。"; // 默认的客户端安全消息
    const sourceText = requestedSource === API_CONFIG.defaultSource ? '默认源' : `'${requestedSource}'`;

    if (error.message === 'API request timed out') {
        statusCode = 504;
        clientMessage = `请求上游 API (${sourceText}) 超时，请稍后重试。`;
    } else if (error.message.includes("API request failed with status")) {
        // 从错误消息中提取状态码 (如果 fetchApiData 按预期抛出)
        const matchStatus = error.message.match(/status (\d+)/);
        const upstreamStatusCode = matchStatus ? parseInt(matchStatus[1], 10) : 502; // 默认为 Bad Gateway
        statusCode = (upstreamStatusCode >= 100 && upstreamStatusCode <= 599) ? upstreamStatusCode : 502;
        clientMessage = `请求上游源 ${sourceText} 失败 (状态码: ${statusCode})。该源可能暂时不可用。`;
    }
    // 对于其他类型的错误，也使用通用的内部错误消息

    ctx.status = statusCode;
    ctx.body = { code: ctx.status, message: clientMessage };
}

function generateProxyUrl(url, proxyBaseUrl = PROXY_URL_ENV) {
    if (proxyBaseUrl && url && (url.includes("kuwo.cn") || url.includes("kugou.com"))) {
        const protocol = url.startsWith('https://') ? 'https://' : 'http://';
        const urlWithoutProtocol = url.substring(protocol.length);
        return `${proxyBaseUrl.replace(/\/$/, '')}/${protocol}${urlWithoutProtocol}`;
    }
    return null;
}

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
                handleApiError(ctx, error, originalSource);
            }
        } else {
            handleApiError(ctx, error, originalSource);
        }
    }
}

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
    if (!value && value !== 0) {
        ctx.status = 400;
        ctx.body = { code: 400, message: `缺少必要参数 ${idAlias}` };
        return false;
    }
    return true;
}

function validateEnumParam(ctx, value, paramName, allowedValues) {
    if (value && !allowedValues.includes(String(value))) {
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

/**
 * 清理并选择性暴露 @unblockneteasemusic/server 的 match() 函数结果。
 * @param {object} matchResult - match() 函数的原始返回结果
 * @returns {object | null} - 清理后的、适合客户端的数据对象，或在结果无效时返回 null
 */
function sanitizeUnmResult(matchResult) {
    if (typeof matchResult !== 'object' || matchResult === null || !matchResult.url) {
        console.warn('Invalid or incomplete result from @unblockneteasemusic/server match:', matchResult);
        return null;
    }
    return {
        url: matchResult.url,
        br: matchResult.br,
        size: matchResult.size,
        type: matchResult.type || matchResult.format, // 兼容 type 或 format 字段
        md5: matchResult.md5,
        // 此处只包含已知且安全的字段。如果 matchResult 包含其他敏感信息，它们不会被传递。
    };
}

const router = new Router();

router.get("/", async (ctx) => {
    ctx.body = "Welcome to the Music API! Refer to documentation for available endpoints.";
});

router.get("/info", async (ctx) => {
    ctx.body = {
        code: 200,
        version: packageJson.version,
        proxy_enabled: !!PROXY_URL_ENV,
        enable_flac: process.env.ENABLE_FLAC === 'true',
        select_max_br: process.env.SELECT_MAX_BR === 'true',
        follow_source_order: process.env.FOLLOW_SOURCE_ORDER === 'true',
        gd_api_default_source: API_CONFIG.defaultSource,
        gd_api_fallback_source: API_CONFIG.fallbackSource,
        gd_api_valid_sources: API_CONFIG.validSources,
    };
});

// --- @unblockneteasemusic/server 相关路由 ---
// 注意: @unblockneteasemusic/server 预期会从 process.env 中读取相关 COOKIE 和其他配置。
router.get("/test", async (ctx) => {
    console.log(`[${new Date().toISOString()}] /test route started for ID ${UNM_SETTINGS.testSongId}`);
    const sourcesToTry = UNM_SETTINGS.defaultSources;
    console.log(`[${new Date().toISOString()}] Attempting to match with @unblockneteasemusic/server sources: ${sourcesToTry.join(', ')}`);
    const startTime = Date.now();
    try {
        const rawData = await match(UNM_SETTINGS.testSongId, sourcesToTry);
        const clientData = sanitizeUnmResult(rawData);
        const duration = Date.now() - startTime;
        console.log(`[${new Date().toISOString()}] @unblockneteasemusic/server match() completed in ${duration}ms.`);

        if (!clientData) {
            ctx.status = 404;
            ctx.body = { code: ctx.status, message: "(@unblockneteasemusic/server) 未能从音源获取有效信息。" };
            return;
        }
        ctx.body = { code: 200, message: "获取成功 (@unblockneteasemusic/server)", data: clientData };
    } catch (error) {
        const duration = Date.now() - startTime;
        console.error(`[${new Date().toISOString()}] Error in /test route for @unblockneteasemusic/server after ${duration}ms:`, error.message); // Log full error server-side
        ctx.status = 500;
        // 返回给客户端通用错误消息
        ctx.body = { code: 500, message: "(@unblockneteasemusic/server) 测试接口处理时发生内部错误。" };
    }
});

router.get("/match", async (ctx) => {
    try {
        const id = ctx.request.query.id;
        if (!validateRequiredParam(ctx, id, 'id')) return;

        const serverSources = ctx.request.query.server
            ? ctx.request.query.server.split(",")
            : UNM_SETTINGS.defaultSources;

        console.log(`@unblockneteasemusic/server: 开始匹配 ID '${id}' 使用源: ${serverSources.join(',')}`);
        const rawData = await match(id, serverSources);
        const clientData = sanitizeUnmResult(rawData);

        if (!clientData) {
            ctx.status = 404;
            ctx.body = { code: ctx.status, message: "(@unblockneteasemusic/server) 未能从音源获取有效信息。" };
            return;
        }
        
        // 原有代理逻辑，现在作用于 clientData
        if (PROXY_URL_ENV && clientData.url && clientData.url.includes("kuwo")) {
             // 此处代理逻辑是根据用户原代码的特定需求，直接拼接
            clientData.proxyUrl = PROXY_URL_ENV + clientData.url.replace(/^http:\/\//, "http/");
        }
        ctx.body = { code: 200, message: "匹配成功 (@unblockneteasemusic/server)", data: clientData };
    } catch (error) {
        console.error("@unblockneteasemusic/server 匹配出现错误:", error.message); // Log full error server-side
        ctx.status = 500;
        // 返回给客户端通用错误消息
        ctx.body = { code: 500, message: "(@unblockneteasemusic/server) 匹配时发生内部错误。" };
    }
});

// --- GDStudio API 路由 ---
router.get("/url", async (ctx) => {
    if (!validateApiSource(ctx, ctx.request.query.source)) return;
    const { id, br = '999' } = ctx.request.query;
    const source = ctx.request.query.source || API_CONFIG.defaultSource;
    if (!validateRequiredParam(ctx, id, 'id')) return;
    if (!validateEnumParam(ctx, br, 'br', ["128", "192", "320", "740", "999"])) return;

    const initialApiParams = { types: "url", id, source, br };
    const processDataFn = (apiResult, currentSource, query) => ({
        id: apiResult.id || query.id,
        source: currentSource,
        br: apiResult.br,
        size: apiResult.size,
        url: apiResult.url,
    });
    await performApiCallWithFallback(ctx, initialApiParams, processDataFn, ctx.request.query, true);
});

router.get("/search", async (ctx) => {
    if (!validateApiSource(ctx, ctx.request.query.source)) return;
    const { name, count = '20', pages = '1' } = ctx.request.query;
    const source = ctx.request.query.source || API_CONFIG.defaultSource;
    if (!validateRequiredParam(ctx, name, 'name')) return;
    if (!validatePositiveIntParam(ctx, count, 'count')) return;
    if (!validatePositiveIntParam(ctx, pages, 'pages')) return;

    const initialApiParams = { types: "search", name, source, count, pages };
    const processDataFn = (apiResult, currentSource) => (
        Array.isArray(apiResult) ? apiResult.map(item => ({
            // 根据GDStudio API文档，search返回的字段都是元数据，此处选择性暴露或全暴露需谨慎
            // 目前全暴露 item 内的字段，但添加了 source
            id: item.id,
            name: item.name,
            artist: item.artist,
            album: item.album,
            pic_id: item.pic_id,
            lyric_id: item.lyric_id,
            source: currentSource // 确保返回结果中包含音源信息
        })) : []
    );
    await performApiCallWithFallback(ctx, initialApiParams, processDataFn, ctx.request.query, false);
});

router.get("/pic", async (ctx) => {
    if (!validateApiSource(ctx, ctx.request.query.source)) return;
    const { id, size = '300' } = ctx.request.query;
    const source = ctx.request.query.source || API_CONFIG.defaultSource;
    if (!validateRequiredParam(ctx, id, 'id', 'pic_id')) return;
    if (!validateEnumParam(ctx, size, 'size', ["300", "500"])) return;

    const initialApiParams = { types: "pic", id, source, size };
    const processDataFn = (apiResult, currentSource) => ({
        url: apiResult.url, // 只暴露URL和来源
        source: currentSource,
    });
    await performApiCallWithFallback(ctx, initialApiParams, processDataFn, ctx.request.query, false);
});

router.get("/lyric", async (ctx) => {
    if (!validateApiSource(ctx, ctx.request.query.source)) return;
    const { id } = ctx.request.query;
    const source = ctx.request.query.source || API_CONFIG.defaultSource;
    if (!validateRequiredParam(ctx, id, 'id', 'lyric_id')) return;

    const initialApiParams = { types: "lyric", id, source };
    const processDataFn = (apiResult, currentSource) => ({
        lyric: apiResult.lyric, // 原歌词
        tlyric: apiResult.tlyric, // 翻译歌词 (可能不存在)
        source: currentSource,
    });
    await performApiCallWithFallback(ctx, initialApiParams, processDataFn, ctx.request.query, false);
});

// --- 404 处理中间件 ---
router.use(async (ctx) => {
    ctx.status = 404;
    if (ctx.accepts('html')) {
        try {
            ctx.type = 'html';
            ctx.body = '<h1>404 Not Found</h1><p>The page you are looking for does not exist.</p>';
            // 如果配置了 koa-views: await ctx.render("404");
        } catch (renderError) {
            console.error("渲染 404 HTML 页面失败, 回退到 JSON 响应:", renderError.message);
            ctx.type = 'json';
            ctx.body = { code: 404, message: '资源未找到 (HTML 渲染失败)' };
        }
    } else {
        ctx.body = { code: 404, message: '资源未找到' };
    }
});

module.exports = router;
