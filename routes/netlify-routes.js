// Netlify Functions 专用路由文件
// 不包含 UNM 模块相关功能，只提供 GDStudio API 兼容的端点

// 引入 Koa Router 模块，用于创建路由
const Router = require("koa-router");

// 引入 package.json 文件
const packageJson = require("../package.json");

// 引入自定义的响应格式化工具函数
const { setSuccessResponse, setErrorResponse } = require('./responseUtils');
// 引入自定义的缓存服务模块
const cacheService = require('./cacheService');

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
            console.log(`Requesting from upstream API: ${apiUrl.toString()}`);
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

// 创建一个新的 Koa Router 实例
const router = new Router();

// 定义根路径 ("/") 的 GET 请求处理器，返回 API 欢迎信息和基本状态
router.get("/", async (ctx) => {
    // 构建要在 data 字段中返回的欢迎信息对象
    const welcomeData = {
        greeting: "Welcome to the Music API!", // 欢迎语
        version: packageJson.version, // 从 package.json 获取的项目版本
        documentation_url: "/public/api-docs.html", // 指向 API 文档的路径 (假设存在)
        status: "API Service is running", // API 运行状态
        environment: "Netlify Functions", // 运行环境
        note: "UNM 功能在此环境中不可用，请使用 GDStudio API 兼容端点"
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
            environment: "Netlify Functions", // 运行环境
            proxy_enabled: !!PROXY_URL_ENV, // 代理是否启用
            gd_api_default_source: API_CONFIG.defaultSource, // GDStudio API 的默认音源
            gd_api_fallback_source: API_CONFIG.fallbackSource, // GDStudio API 的回退音源
            gd_api_valid_sources: API_CONFIG.validSources, // GDStudio API 支持的音源列表
            cache_enabled: cacheService.CACHE_ENABLED, // 缓存是否启用
            cache_default_ttl_seconds: cacheService.DEFAULT_TTL_SECONDS, // 缓存的默认 TTL (秒)
            unm_available: false, // UNM 在 Netlify 环境中不可用
            available_endpoints: ["/url", "/search", "/pic", "/lyric"] // 可用的端点
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

// UNM 相关路由 - 返回不可用信息
router.get("/test", async (ctx) => {
    setErrorResponse(ctx, "UNM 服务在 Netlify Functions 环境中不可用。请使用其他可用的 API 端点。", 503, {
        service: "UNM",
        environment: "Netlify Functions",
        available_endpoints: ["/url", "/search", "/pic", "/lyric"],
        suggestion: "请使用 GDStudio API 兼容的端点获取音乐资源"
    });
});

router.get("/match", async (ctx) => {
    setErrorResponse(ctx, "UNM 服务在 Netlify Functions 环境中不可用。请使用其他可用的 API 端点。", 503, {
        service: "UNM",
        environment: "Netlify Functions",
        available_endpoints: ["/url", "/search", "/pic", "/lyric"],
        suggestion: "请使用 GDStudio API 兼容的端点获取音乐资源"
    });
});

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

// GDStudio API 兼容端点

// 定义 "/url" 路径的 GET 请求处理器，获取歌曲播放链接
router.get("/url", async (ctx) => {
    // 验证 source 参数
    if (!validateApiSource(ctx, ctx.request.query.source)) return;
    // 从查询参数解构获取 id (歌曲ID) 和 br (比特率，默认为 '320')
    const { id, br = '320' } = ctx.request.query;
    // 获取音源
    const source = ctx.request.query.source || API_CONFIG.defaultSource;
    // 验证 id 是否提供
    if (!validateRequiredParam(ctx, id, 'id')) return;

    // 构建初始 API 请求参数对象
    const initialApiParams = { types: "url", id, source, br };
    // 定义处理 API 结果的函数
    const processDataFn = (apiResult, currentSourceParam, query) => ({
        id: apiResult.id || query.id, // 使用 API 返回的 ID，或原始查询的 ID 作为备用
        br: apiResult.br, // 比特率
        size: apiResult.size, // 文件大小
        url: apiResult.url, // 播放 URL
        type: apiResult.type, // 文件类型
        // 'source' 字段将由 performApiCallWithFallback 在缓存前添加
    });
    // 执行 API 调用，应用代理逻辑
    await performApiCallWithFallback(ctx, initialApiParams, processDataFn, ctx.request.query, true);
});

// 定义 "/search" 路径的 GET 请求处理器，搜索歌曲
router.get("/search", async (ctx) => {
    // 验证 source 参数
    if (!validateApiSource(ctx, ctx.request.query.source)) return;
    // 从查询参数解构获取 name (搜索关键词)、count (返回数量，默认为 '10') 和 pages (页码，默认为 '1')
    const { name, count = '10', pages = '1' } = ctx.request.query;
    // 获取音源
    const source = ctx.request.query.source || API_CONFIG.defaultSource;
    // 验证 name 是否提供
    if (!validateRequiredParam(ctx, name, 'name')) return;

    // 构建初始 API 请求参数
    const initialApiParams = { types: "search", name, source, count, pages };
    // 定义处理 API 搜索结果的函数
    const processDataFn = (apiResult, currentSourceParam) => (
        Array.isArray(apiResult) ? apiResult.map(item => ({ // 如果 API 结果是数组
            id: item.id, // 歌曲 ID
            name: item.name, // 歌曲名
            artist: item.artist, // 艺术家
            album: item.album, // 专辑
            pic_id: item.pic_id, // 封面图片 ID
            url_id: item.url_id, // 播放链接 ID
            lyric_id: item.lyric_id, // 歌词 ID
            // 'source' 字段将由 performApiCallWithFallback 在缓存前添加
        })) : [] // 如果 API 结果不是数组，返回空数组
    );
    // 执行 API 调用，不应用代理逻辑
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
    // 执行 API 调用，不应用代理逻辑
    await performApiCallWithFallback(ctx, initialApiParams, processDataFn, ctx.request.query, false);
});

// 定义 "/lyric" 路径的 GET 请求处理器，获取歌曲歌词
router.get("/lyric", async (ctx) => {
    // 验证 source 参数
    if (!validateApiSource(ctx, ctx.request.query.source)) return;
    // 从查询参数解构获取 id (歌词ID)
    const { id } = ctx.request.query;
    // 获取音源
    const source = ctx.request.query.source || API_CONFIG.defaultSource;
    // 验证 id 是否提供
    if (!validateRequiredParam(ctx, id, 'id')) return;

    // 构建初始 API 请求参数
    const initialApiParams = { types: "lyric", id, source };
    // 定义处理 API 歌词结果的函数
    const processDataFn = (apiResult, currentSourceParam) => ({
        lyric: apiResult.lyric, // 原文歌词
        tlyric: apiResult.tlyric, // 翻译歌词 (可能不存在)
        // 'source' 字段将由 performApiCallWithFallback 在缓存前添加
    });
    // 执行 API 调用，不应用代理逻辑
    await performApiCallWithFallback(ctx, initialApiParams, processDataFn, ctx.request.query, false);
});

// 导出路由器
module.exports = router;
