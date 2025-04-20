// 引入 Koa Router 模块，用于创建路由
const Router = require("koa-router");
// 引入 @unblockneteasemusic/server 模块，用于匹配和获取音乐链接
const match = require("@unblockneteasemusic/server");
// 引入 package.json 文件，用于获取项目版本等信息（假设它在上一级目录）
const packageJson = require("../package.json");
// 创建一个新的 Koa Router 实例
const router = new Router();

// 定义外部 GDStudio API 的基础 URL 常量
const API_BASE_URL = "https://music-api.gdstudio.xyz/api.php";

// 定义一个异步辅助函数，用于调用 GDStudio API
async function fetchApiData(params) {
  // 基于基础 URL 创建一个新的 URL 对象
  const apiUrl = new URL(API_BASE_URL);
  // 遍历传入的参数对象
  Object.entries(params).forEach(([key, value]) => {
    // 如果参数值不是 undefined 或 null
    if (value !== undefined && value !== null) {
      // 将参数键值对追加到 URL 的查询字符串中
      apiUrl.searchParams.append(key, value);
    }
  });

  // 添加超时控制：创建一个 AbortController 实例
  const controller = new AbortController();
  // 设置一个 10 秒的定时器，超时后调用 abort 方法
  const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

  // 使用 try...catch 块处理可能的错误
  try {
    // 记录将要请求的上游 API URL
    console.log(`Fetching from upstream API: ${apiUrl.toString()}`);
    // 使用 fetch 发起网络请求，传入 URL 和 AbortSignal
    const response = await fetch(apiUrl.toString(), { signal: controller.signal });
    // 如果请求成功完成（未超时），清除之前设置的超时定时器
    clearTimeout(timeoutId);

    // 检查响应状态码是否表示成功 (status code 200-299)
    if (!response.ok) {
      // 如果响应不成功，记录详细的警告信息
      console.warn(
        `Upstream API request failed! URL: ${apiUrl.toString()}, Status: ${response.status}, StatusText: ${response.statusText}`
      );
      // 初始化错误响应体变量
      let errorBody = null;
      // 尝试读取响应体
      try {
        // 首先尝试将响应体作为文本读取
        const textBody = await response.text();
        // 记录原始文本响应体
        console.warn(`Upstream API response body (text): ${textBody}`);
        // 尝试将文本解析为 JSON
        errorBody = JSON.parse(textBody);
      } catch (e) {
        // 如果解析 JSON 失败，记录警告
        console.warn(`Failed to parse upstream API response body as JSON: ${e.message}`);
        // 保留 errorBody 为 null 或根据需要使用 textBody
      }
      // 抛出一个包含原始状态码和响应信息的错误
      throw new Error(
        `API request failed with status ${response.status}. Response: ${JSON.stringify(errorBody) || response.statusText}`
      );
    }
    // 如果响应成功，将响应体解析为 JSON
    const result = await response.json();
    // 返回解析后的 JSON 结果
    return result;
  } catch (error) {
    // 确保在出错时也清除超时定时器
    clearTimeout(timeoutId);
    // 检查错误是否是由于超时引起的 (AbortError)
    if (error.name === 'AbortError') {
      // 如果是超时错误，记录错误信息
      console.error(`Upstream API request timed out: ${apiUrl.toString()}`);
      // 抛出一个特定的超时错误
      throw new Error('API request timed out');
    }
    // 记录捕获到的其他错误（可能是 fetch 错误或上面手动抛出的错误）
    console.error(`Error during fetchApiData for [${apiUrl.toString()}]:`, error);
    // 重新抛出原始错误或包装后的错误
    throw error;
  }
}

// 定义一个辅助函数，用于标准化处理路由中的 API 错误
function handleApiError(ctx, error, requestedSource = 'default') {
  // 在服务器端记录完整的错误信息和请求路径
  console.error(`${ctx.path} 请求失败:`, error);

  // 初始化默认的状态码和错误消息
  let statusCode = 500;
  let message = "服务器内部错误";
  // 根据请求的源生成用于错误消息的文本
  const sourceText = requestedSource === 'default' ? '默认源' : `'${requestedSource}'`;

  // 检查错误消息是否表示请求超时
  if (error.message === 'API request timed out') {
    // 如果是超时，设置状态码为 504 (Gateway Timeout)
    statusCode = 504;
    // 设置相应的错误消息
    message = `请求上游 API 超时，请稍后重试。`;
    // 检查错误消息是否表示上游 API 请求失败
  } else if (error.message.includes("API request failed")) {
    // 尝试从错误消息中提取原始的上游状态码
    const match = error.message.match(/status (\d+)/);
    // 如果提取到状态码，则解析为整数，否则默认为 502
    const upstreamStatusCode = match ? parseInt(match[1], 10) : 502;
    // 确保提取到的状态码是有效的 HTTP 状态码 (100-599)，否则默认为 502
    statusCode = (upstreamStatusCode >= 100 && upstreamStatusCode <= 599) ? upstreamStatusCode : 502;
    // 设置包含源信息和状态码的具体错误消息
    message = `请求上游源 ${sourceText} 失败 (状态码: ${statusCode})，该源可能暂时不可用，请尝试更换 source 参数或稍后再试。`;
  }
  // 对于其他类型的内部错误，保持 statusCode 为 500

  // 设置 Koa 上下文的响应状态码
  ctx.status = statusCode;
  // 设置 Koa 上下文的响应体，包含状态码和错误消息
  ctx.body = {
    code: ctx.status,
    message: message,
  };
}

// 定义根路由 ("/") 的 GET 请求处理
router.get("/", async (ctx) => {
  // 使用 koa-views 渲染名为 "index" 的视图（通常是 public/index.html）
  await ctx.render("index");
});

// 定义 "/info" 路由的 GET 请求处理
router.get("/info", async (ctx) => {
  // 设置响应体，包含固定的成功代码、项目版本和 FLAC 启用状态
  ctx.body = {
    code: 200, // HTTP 状态码
    version: packageJson.version, // 从 package.json 获取的版本号
    // 从环境变量读取 ENABLE_FLAC，并确保转换为布尔值
    enable_flac: process.env.ENABLE_FLAC === 'true',
  }
});

// 定义 "/test" 路由的 GET 请求处理 (用于测试 unblockneteasemusic 核心功能)
router.get("/test", async (ctx) => {
  // 使用 @unblockneteasemusic/server 的 match 函数测试特定歌曲 ID (416892104)
  // 注意：如果 match 函数需要 cookies 或 keys，应从环境变量中读取并传入
  const data = await match(416892104, [ // 指定要尝试匹配的音源列表
    "kugou",
    "kuwo",
    "migu",
    "pyncmd",
    "bilibili",
    "youtube",
    "youtube-dl",
    "yt-dlp",
    "qq",
  ]).then((res) => { // match 函数返回一个 Promise
    return res; // 返回匹配结果
  });
  // 设置响应体，包含成功代码、消息和获取到的数据
  ctx.body = {
    code: 200,
    message: "获取成功",
    data, // 包含匹配到的 URL 等信息
  };
});

// 定义 "/match" 路由的 GET 请求处理 (由 @unblockneteasemusic/server 处理)
router.get("/match", async (ctx) => {
  // 使用 try...catch 处理可能的错误
  try {
    // 从查询参数中获取歌曲 ID
    const id = ctx.request.query.id;
    // 从查询参数中获取音源列表（逗号分隔），如果没有提供则使用默认列表
    // 注意：此处的 server 列表是给 @unblockneteasemusic/server 用的，与 GDStudio API 的 source 不同
    const server = ctx.request.query.server
      ? ctx.request.query.server.split(",")
      : ["pyncmd", "kuwo", "bilibili", "migu", "kugou", "qq", "youtube", "youtube-dl", "yt-dlp"];
    // 记录匹配请求信息（考虑在生产环境中减少日志）
    console.log("开始匹配：" + id + " - " + server);
    // 验证 ID 是否存在
    if (!id) {
      // 如果缺少 ID，返回 400 错误
      ctx.body = { code: 400, message: "参数不完整" };
      ctx.status = 400;
      return false; // 提前返回
    }
    // 调用 @unblockneteasemusic/server 的 match 函数进行匹配
    // 注意：如果需要 cookies/keys，需配置到 @unblockneteasemusic/server 或通过环境变量传递
    const data = await match(id, server).then((res) => {
      return res; // 返回匹配结果
    });
    // 从环境变量读取代理 URL
    const proxy = process.env.PROXY_URL;
    // 如果配置了代理 URL 且匹配到的 URL 存在且包含 "kuwo" (按原逻辑)
    if (proxy && data.url && data.url.includes("kuwo")) {
      // 生成代理后的 URL
      data.proxyUrl = proxy + data.url.replace(/^http:\/\//, "http/");
    }
    // 设置成功响应体
    ctx.body = {
      code: 200,
      message: "匹配成功",
      data,
    };
  } catch (error) {
    // 如果匹配过程中发生错误，记录完整错误
    console.error("匹配出现错误：", error);
    // 设置 500 内部服务器错误状态
    ctx.status = 500;
    // 返回通用的失败消息给客户端
    ctx.body = {
      code: 500,
      message: "匹配失败",
    };
  }
});

/* 网易云音乐获取 (使用 GDStudio API)
十分感谢自GDStudio的音源API, 这里贴个链接: music.gdstudio.xyz
*/
// 定义 "/url" 路由的 GET 请求处理 (获取歌曲播放链接)
router.get("/url", async (ctx) => {
  // 从查询参数解构所需参数，设置默认值
  const { id, source = 'netease', br = '999' } = ctx.request.query;
  // 保存原始请求的 source，用于错误处理和回退逻辑判断
  const originalSource = source;

  // 使用 try...catch 处理可能的错误
  try {
    // 1. 参数验证：检查 id 是否存在
    if (!id) {
      ctx.status = 400; // 设置 400 Bad Request 状态码
      ctx.body = { code: 400, message: "缺少必要参数 id" }; // 设置响应体
      return; // 提前返回
    }

    // 1. 参数验证：检查 br (音质) 是否有效
    const validBR = ["128", "192", "320", "740", "999"]; // 定义有效的音质选项
    if (!validBR.includes(br)) { // 如果请求的 br 不在有效列表中
      ctx.status = 400; // 设置 400 Bad Request 状态码
      ctx.body = { // 设置包含错误信息和允许值的响应体
        code: 400,
        message: "无效音质参数 br",
        allowed_values: validBR
      };
      return; // 提前返回
    }

    // 1. 参数验证 (可选): 检查 source 是否有效 (此处注释掉了，如果需要可以启用)
    // const validSources = ['netease', 'tencent', 'kuwo', ...];
    // if (!validSources.includes(source)) { ... }

    // 2. 准备调用 API 的参数
    const params = { types: "url", id, source: originalSource, br }; // 使用原始请求的 source 进行首次尝试
    // 调用 fetchApiData 函数请求外部 API
    const result = await fetchApiData(params);

    // 3. 处理成功的 API 响应结果
    let responseData = {
      id: result.id || id, // 如果 API 未返回 id，则使用请求的 id
      source: originalSource, // 默认反映首次尝试成功的源
      br: result.br,       // API 返回的实际音质
      size: result.size,     // 文件大小
      url: result.url,       // 音乐链接
    };

    // 3. 处理代理逻辑
    // 从环境变量读取代理 URL
    const proxy = process.env.PROXY_URL;
    // 如果代理 URL 存在，且 API 返回的 URL 存在，且 URL 包含 "kuwo.cn" (基于原逻辑的特定判断)
    if (proxy && result.url && result.url.includes("kuwo.cn")) {
      // 构造代理 URL，确保协议正确拼接
      const protocol = result.url.startsWith('https') ? 'https://' : 'http://'; // 判断原始 URL 协议
      const urlWithoutProtocol = result.url.substring(protocol.length); // 去掉协议部分
      // 安全地拼接代理 URL，移除代理地址末尾的斜杠（如果有）
      responseData.proxyUrl = `${proxy.replace(/\/$/, '')}/${protocol}${urlWithoutProtocol}`;
    }

    // 设置 Koa 的成功响应体
    ctx.body = {
      code: 200,
      message: "请求成功",
      data: responseData
    };

  } catch (error) {
    // 捕获到错误（可能是参数验证错误、fetchApiData 错误或后续处理错误）
    // 检查错误是否是上游 API 错误 (基于错误消息判断) 且原始请求的源不是 'kugou' (避免无限回退)
    if ((error.message.includes("API request failed") || error.message === 'API request timed out') && originalSource !== 'kugou') {
      // 如果满足回退条件，记录警告信息
      console.warn(`Upstream request for source '${originalSource}' failed. Attempting fallback to 'kugou'.`);
      // 使用嵌套的 try...catch 尝试回退逻辑
      try {
        // 准备回退请求的参数，将 source 设置为 'kugou'
        const fallbackParams = { types: "url", id, source: 'kugou', br };
        // 调用 fetchApiData 尝试请求 'kugou' 源
        const fallbackResult = await fetchApiData(fallbackParams);

        // 如果回退请求成功
        // 准备回退成功的响应数据
        let responseData = {
          id: fallbackResult.id || id, // 使用 API 返回的 id 或请求的 id
          source: 'kugou', // 明确指出数据来自 'kugou' 源
          br: fallbackResult.br,       // 回退结果的音质
          size: fallbackResult.size,     // 回退结果的大小
          url: fallbackResult.url,       // 回退结果的 URL
        };
        // 从环境变量获取代理 URL
        const proxy = process.env.PROXY_URL;
        // 对回退得到的 URL 应用代理逻辑 (假设酷我或酷狗的链接可能需要代理)
        if (proxy && fallbackResult.url && (fallbackResult.url.includes("kuwo.cn") || fallbackResult.url.includes("kugou.com"))) {
          const protocol = fallbackResult.url.startsWith('https') ? 'https://' : 'http://';
          const urlWithoutProtocol = fallbackResult.url.substring(protocol.length);
          responseData.proxyUrl = `${proxy.replace(/\/$/, '')}/${protocol}${urlWithoutProtocol}`;
        }
        // 记录回退成功的日志
        console.log(`Fallback to 'kugou' succeeded for id ${id}.`);
        // 设置成功的响应体，消息中注明是回退成功
        ctx.body = { code: 200, message: `请求成功 (回退至 kugou 源)`, data: responseData };
        // 成功回退后，必须返回，结束请求处理
        return;

      } catch (fallbackError) {
        // 如果回退尝试也失败了，记录错误
        console.error(`Fallback attempt to 'kugou' also failed:`, fallbackError);
        // 调用 handleApiError 处理 *最初* 的那个错误，并告知原始请求的源
        handleApiError(ctx, error, originalSource);
      }
    } else {
      // 如果错误不是上游 API 错误，或者原始请求的源已经是 'kugou'，
      // 则直接调用 handleApiError 处理当前捕获到的错误，并告知原始请求的源
      handleApiError(ctx, error, originalSource);
    }
  }
});

// 定义 "/search" 路由的 GET 请求处理 (搜索音乐)
router.get("/search", async (ctx) => {
  // 从查询参数解构，设置默认值
  const { name, source = 'netease', count = '20', pages = '1' } = ctx.request.query;
  // 保存原始请求的 source
  const originalSource = source;

  // 使用 try...catch 处理可能的错误
  try {
    // 1. 参数验证：检查 name 是否存在
    if (!name) {
      ctx.status = 400;
      ctx.body = { code: 400, message: "缺少必要参数 name" };
      return;
    }
    // 1. 参数验证：检查 count 和 pages 是否是正整数
    if (isNaN(parseInt(count)) || isNaN(parseInt(pages)) || parseInt(count) <= 0 || parseInt(pages) <= 0) {
      ctx.status = 400;
      ctx.body = { code: 400, message: "参数 count 和 pages 必须是正整数" };
      return;
    }

    // 2. 调用 API
    const params = { types: "search", name, source: originalSource, count, pages }; // 使用原始 source 首次尝试
    const results = await fetchApiData(params);
    // 处理成功结果，确保每个结果项都包含原始请求的 source 字段
    const processedResults = results.map(item => ({ ...item, source: originalSource }));
    // 设置成功响应体
    ctx.body = { code: 200, message: "搜索成功", data: processedResults };

  } catch (error) {
    // 捕获错误，检查是否满足回退条件
    if ((error.message.includes("API request failed") || error.message === 'API request timed out') && originalSource !== 'kugou') {
      // 记录尝试回退的日志
      console.warn(`Upstream request for source '${originalSource}' failed. Attempting fallback to 'kugou'.`);
      // 使用嵌套 try...catch 尝试回退
      try {
        // 准备回退参数，设置 source 为 'kugou'
        const fallbackParams = { types: "search", name, source: 'kugou', count, pages };
        // 调用 API 尝试回退
        const fallbackResults = await fetchApiData(fallbackParams);
        // 处理回退成功的结果，确保每个结果项的 source 字段为 'kugou'
        const processedResults = fallbackResults.map(item => ({ ...item, source: 'kugou' }));
        // 记录回退成功的日志
        console.log(`Fallback to 'kugou' succeeded for search '${name}'.`);
        // 设置成功响应体，消息中注明是回退成功
        ctx.body = { code: 200, message: `搜索成功 (回退至 kugou 源)`, data: processedResults };
        // 成功回退后返回
        return;
      } catch (fallbackError) {
        // 如果回退尝试失败，记录错误
        console.error(`Fallback attempt to 'kugou' also failed:`, fallbackError);
        // 调用 handleApiError 处理原始错误
        handleApiError(ctx, error, originalSource);
      }
    } else {
      // 不满足回退条件，直接处理原始错误
      handleApiError(ctx, error, originalSource);
    }
  }
});

// 定义 "/pic" 路由的 GET 请求处理 (获取专辑图)
router.get("/pic", async (ctx) => {
  // 从查询参数解构，设置默认值
  const { id, source = 'netease', size = '300' } = ctx.request.query;
  // 保存原始请求的 source
  const originalSource = source;

  // 使用 try...catch 处理可能的错误
  try {
    // 1. 参数验证：检查 id 是否存在
    if (!id) {
      ctx.status = 400;
      ctx.body = { code: 400, message: "缺少必要参数 id (pic_id)" };
      return;
    }
    // 1. 参数验证：检查 size 是否有效
    const validSizes = ["300", "500"];
    if (!validSizes.includes(size)) {
      ctx.status = 400;
      ctx.body = { code: 400, message: "无效图片尺寸参数 size", allowed_values: validSizes };
      return;
    }

    // 2. 调用 API
    const params = { types: "pic", id, source: originalSource, size }; // 使用原始 source 首次尝试
    const result = await fetchApiData(params);
    // 处理成功结果，添加原始请求的 source 字段（API 本身可能不返回 source）
    const responseData = { ...result, source: originalSource };
    // 设置成功响应体
    ctx.body = { code: 200, message: "请求成功", data: responseData };

  } catch (error) {
    // 捕获错误，检查是否满足回退条件
    if ((error.message.includes("API request failed") || error.message === 'API request timed out') && originalSource !== 'kugou') {
      // 记录尝试回退的日志
      console.warn(`Upstream request for source '${originalSource}' failed. Attempting fallback to 'kugou'.`);
      // 使用嵌套 try...catch 尝试回退
      try {
        // 准备回退参数，设置 source 为 'kugou'
        const fallbackParams = { types: "pic", id, source: 'kugou', size };
        // 调用 API 尝试回退
        const fallbackResult = await fetchApiData(fallbackParams);
        // 处理回退成功的结果，将 source 字段设为 'kugou'
        const responseData = { ...fallbackResult, source: 'kugou' };
        // 记录回退成功的日志
        console.log(`Fallback to 'kugou' succeeded for pic id ${id}.`);
        // 设置成功响应体，消息中注明是回退成功
        ctx.body = { code: 200, message: `请求成功 (回退至 kugou 源)`, data: responseData };
        // 成功回退后返回
        return;
      } catch (fallbackError) {
        // 如果回退尝试失败，记录错误
        console.error(`Fallback attempt to 'kugou' also failed:`, fallbackError);
        // 调用 handleApiError 处理原始错误
        handleApiError(ctx, error, originalSource);
      }
    } else {
      // 不满足回退条件，直接处理原始错误
      handleApiError(ctx, error, originalSource);
    }
  }
});

// 定义 "/lyric" 路由的 GET 请求处理 (获取歌词)
router.get("/lyric", async (ctx) => {
  // 从查询参数解构，设置默认 source
  const { id, source = 'netease' } = ctx.request.query;
  // 保存原始请求的 source
  const originalSource = source;

  // 使用 try...catch 处理可能的错误
  try {
    // 1. 参数验证：检查 id 是否存在
    if (!id) {
      ctx.status = 400;
      ctx.body = { code: 400, message: "缺少必要参数 id (lyric_id)" };
      return;
    }

    // 2. 调用 API
    const params = { types: "lyric", id, source: originalSource }; // 使用原始 source 首次尝试
    const result = await fetchApiData(params);
    // 处理成功结果，添加原始请求的 source 字段
    const responseData = { ...result, source: originalSource };
    // 设置成功响应体
    ctx.body = { code: 200, message: "请求成功", data: responseData };

  } catch (error) {
    // 捕获错误，检查是否满足回退条件
    if ((error.message.includes("API request failed") || error.message === 'API request timed out') && originalSource !== 'kugou') {
      // 记录尝试回退的日志
      console.warn(`Upstream request for source '${originalSource}' failed. Attempting fallback to 'kugou'.`);
      // 使用嵌套 try...catch 尝试回退
      try {
        // 准备回退参数，设置 source 为 'kugou'
        const fallbackParams = { types: "lyric", id, source: 'kugou' };
        // 调用 API 尝试回退
        const fallbackResult = await fetchApiData(fallbackParams);
        // 处理回退成功的结果，将 source 字段设为 'kugou'
        const responseData = { ...fallbackResult, source: 'kugou' };
        // 记录回退成功的日志
        console.log(`Fallback to 'kugou' succeeded for lyric id ${id}.`);
        // 设置成功响应体，消息中注明是回退成功
        ctx.body = { code: 200, message: `请求成功 (回退至 kugou 源)`, data: responseData };
        // 成功回退后返回
        return;
      } catch (fallbackError) {
        // 如果回退尝试失败，记录错误
        console.error(`Fallback attempt to 'kugou' also failed:`, fallbackError);
        // 调用 handleApiError 处理原始错误
        handleApiError(ctx, error, originalSource);
      }
    } else {
      // 不满足回退条件，直接处理原始错误
      handleApiError(ctx, error, originalSource);
    }
  }
});

// 定义 404 中间件，处理未匹配的路由
router.use(async (ctx) => {
  // 如果 vercel.json 配置了静态 404 路由，这个中间件可能不会被 Vercel 环境调用
  // 保留此逻辑以处理 Koa 内部未匹配的路径，或用于本地开发

  // 设置 HTTP 状态码为 404 Not Found
  ctx.status = 404;
  // 检查客户端接受的内容类型
  if (ctx.accepts('html')) { // 如果客户端期望 HTML
    // 渲染名为 "404" 的视图 (需要 public/404.html 和 koa-views 配置)
    await ctx.render("404");
  } else { // 如果客户端期望其他类型（如 JSON）
    // 返回 JSON 格式的 404 错误信息
    ctx.body = { code: 404, message: 'Not Found' };
  }
});

// 导出配置好的 router 实例，供主应用 (index.js) 使用
module.exports = router;
