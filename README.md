<img src="./public/favicon.png" alt="logo" width="140" height="140" align="right">

# UNM-Server (API 服务)

一个基于 Node.js 和 Koa 实现的音乐 API 服务。它通过整合 `@unblockneteasemusic/server` 核心库和 GDStudio 兼容的API，为网易云等平台中可能无法播放的（灰色）歌曲提供可播放链接的替换方案。此外，服务还提供歌曲搜索、封面图片获取、歌词检索等功能，旨在为开发者提供一个稳定、全面的音乐数据接口。

**项目部署示例:** [https://api-unms.axingchen.com/](https://api-unms.axingchen.com/)
**详细 API 文档页面:** [https://api-unms.axingchen.com/api-docs.html](https://api-unms.axingchen.com/api-docs.html)

## ✨ 主要特性

-   **多音源解锁**: 集成 `@unblockneteasemusic/server`，尝试从包括 QQ音乐、酷狗音乐、酷我音乐、咪咕音乐、B站等在内的多个音源匹配和替换变灰歌曲链接。
-   **GDStudio API 兼容接口**: 提供与 GDStudio API 类似的接口，用于获取歌曲URL、执行歌曲搜索、获取专辑封面、以及检索歌词。这些接口内置了当主音源请求失败时，自动回退到备用音源（默认为酷狗）的逻辑。
-   **智能缓存机制**: 对所有外部 API（包括 GDStudio API 和 UNM 的 `match` 调用）的成功响应进行缓存。这能显著减少对上游服务器的重复请求，大幅提高常用请求的响应速度，并降低被上游限制的风险。
-   **统一且美化的响应格式**:
    -   所有 API 接口均返回统一的 JSON 结构：`{ "code": <状态码>, "message": "<消息>", "data": <数据对象或null> }`，方便客户端进行统一处理。
    -   所有 JSON 响应都进行了美化输出（带缩进和换行），提高了人工阅读和API调试时的便利性。
-   **动态域名支持**: API 文档页面 (`api-docs.html`) 中的示例链接会自动使用当前服务部署的实际域名。
-   **环境变量配置**: 支持通过 `.env` 文件（本地开发）或部署平台的环境变量（生产环境）进行灵活配置，包括端口、代理、缓存参数、API密钥及各平台Cookie等。
-   **参数验证**: 对传入的API参数进行校验，对无效或缺失的参数返回明确的错误提示。

## 🚀 快速开始

### 环境要求

-   Node.js >= 18.0.0
-   pnpm (推荐, 版本 >= 9.0.0) 或 npm / yarn

### 安装与运行

1.  **克隆项目** (如果从源码部署):
    ```bash
    # 替换为您的实际仓库地址
    git clone https://github.com/imsyy/UNM-Server-AXC.git
    cd UNM-Server-AXC
    ```

2.  **安装依赖**:
    ```bash
    pnpm install
    ```
    (如果使用 npm: `npm install`; 如果使用 yarn: `yarn install`)

3.  **配置环境变量**:
    在项目根目录下创建 `.env` 文件 (可以从 `.env.example` 复制，如果项目提供的话)。根据您的需求填写配置项。关键配置项见下方“配置”章节。
    *对于 Vercel 等 Serverless 平台，请在平台的项目设置中配置这些环境变量。*

4.  **运行服务**:
    * **开发模式** (使用 nodemon 实现热重载):
        ```bash
        pnpm dev
        ```
    * **生产模式**:
        ```bash
        pnpm start
        ```
    服务启动后，默认将在 `http://localhost:5678` (或您在 `.env` 中配置的 `PORT`) 上可用。

## 🛠️ API 端点详解

所有 API 接口的基础 URL 为您的部署域名，例如：`https://api-unms.axingchen.com`。
所有接口均返回统一的 JSON 结构：`{ "code": <状态码>, "message": "<消息>", "data": <数据或null> }`。
其中 `code` 通常与 HTTP 状态码一致。

---

### 1. `GET /` - API 根路径

**描述:** 返回 API 服务的欢迎信息、当前版本和运行状态。
**参数:** 无

**示例请求:**
```http
GET https://api-unms.axingchen.com/
```

**成功响应示例 (200 OK):**
```json
{
  "code": 200,
  "message": "API 服务运行中",
  "data": {
    "greeting": "Welcome to the Music API!",
    "version": "1.0.6", // 将从 package.json 读取
    "documentation_url": "/public/api-docs.html",
    "status": "API Service is running"
  }
}
```

### 2. `GET /info` - API 配置信息

**描述:** 获取 API 服务的详细配置和当前状态信息，如代理、缓存、音源等设置。
**参数:** 无

**示例请求:**
```http
GET https://api-unms.axingchen.com/info
```

**成功响应示例 (200 OK):**
```json
{
  "code": 200,
  "message": "API 信息获取成功",
  "data": {
    "version": "1.0.6", // 将从 package.json 读取
    "proxy_enabled": true, // 布尔值，取决于 PROXY_URL 环境变量是否设置
    "enable_flac": true, // 布尔值，取决于 ENABLE_FLAC 环境变量
    "select_max_br": true, // 布尔值，取决于 SELECT_MAX_BR 环境变量
    "follow_source_order": true, // 布尔值，取决于 FOLLOW_SOURCE_ORDER 环境变量
    "gd_api_default_source": "netease", // GDStudio API 的默认音源
    "gd_api_fallback_source": "kugou",  // GDStudio API 的回退音源
    "gd_api_valid_sources": ["netease", "tencent", "tidal", "spotify", "ytmusic", "qobuz", "joox", "deezer", "migu", "kugou", "kuwo", "ximalaya"],
    "cache_enabled": true, // 布尔值，取决于 CACHE_ENABLED 环境变量
    "cache_default_ttl_seconds": 3600 // 缓存默认TTL（秒）
  }
}
```

### 3. `GET /test` - UNM 功能测试

**描述:** 使用预设的歌曲 ID 测试 @unblockneteasemusic/server 核心库的解锁功能，并返回获取到的音源信息。此接口的结果会被缓存。
**参数:** 无

**示例请求:**
```http
GET https://api-unms.axingchen.com/test
```

**成功响应示例 (200 OK):**
```json
{
  "code": 200,
  "message": "获取成功", // 若来自缓存，则为 "获取成功 (from cache)"
  "data": {
    "url": "http://example.com/song.mp3", // 实际播放链接
    "br": 320000, // 比特率，例如 320kbps
    "size": 10485760, // 文件大小（字节）
    "type": "mp3", // 文件类型
    "md5": "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx", // MD5 哈希 (可能存在)
    "source": "kuwo" // 成功获取到链接的音源代号
  }
}
```

**失败响应示例 (404 Not Found - 未能获取信息):**
```json
{
  "code": 404,
  "message": "未能从音源获取有效信息。",
  "data": null
}
```

### 4. `GET /match` - UNM 歌曲匹配

**描述:** 根据提供的歌曲 ID，使用 @unblockneteasemusic/server 核心库从多个音源尝试匹配可播放链接。此接口的结果会被缓存。

**参数:**

| 参数名 | 类型 | 是否必需 | 默认值 (代码内配置) | 描述 |
|--------|------|----------|---------------------|------|
| id | string | 是 | N/A | 歌曲的 ID (通常指网易云音乐的歌曲 ID)。 |
| server | string | 否 | UNM_SETTINGS.defaultSources | 逗号分隔的音源代号列表 (如 kuwo,migu,qq)，指定匹配范围和顺序。 |

**示例请求:**
```http
GET https://api-unms.axingchen.com/match?id=1962165898&server=kuwo,qq
```

**成功响应示例 (200 OK):**
```json
{
  "code": 200,
  "message": "匹配成功", // 若来自缓存，则为 "匹配成功 (from cache)"
  "data": {
    "url": "http://example.com/matched_song.mp3",
    "br": 320000,
    "size": 10240000,
    "type": "flac",
    "md5": "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    "source": "kuwo", // 成功匹配的音源
    "proxyUrl": "http://yourproxy.com/http/example.com/matched_song.mp3" // 如果配置了代理且链接满足代理条件
  }
}
```

**失败响应示例 (400 Bad Request - 缺少id参数):**
```json
{
  "code": 400,
  "message": "缺少必要参数 id",
  "data": {
    "required_param": "id"
  }
}
```

### 5. `GET /url` - 获取歌曲播放链接 (GDStudio API)

**描述:** 从 GDStudio 兼容的 API 获取指定歌曲的播放链接，支持音源回退和缓存。

**参数:**

| 参数名 | 类型 | 是否必需 | 默认值 (代码内配置) | 描述 |
|--------|------|----------|---------------------|------|
| id | string | 是 | N/A | 歌曲的 Track ID。 |
| source | string | 否 | API_CONFIG.defaultSource | 指定音源 (如 netease, qq, kugou 等)。 |
| br | string | 否 | 999 | 请求的音质/比特率 (128, 192, 320, 740 (FLAC), 999 (最高FLAC))。 |

**示例请求:**
```http
GET https://api-unms.axingchen.com/url?id=歌曲TrackID&source=netease&br=320
```

**成功响应示例 (200 OK):**
```json
{
  "code": 200,
  "message": "请求成功 (源: netease)", // 消息会反映实际来源，如缓存或回退
  "data": {
    "id": "歌曲TrackID",
    "br": 320000, // 实际获取到的比特率
    "size": 10485760, // 文件大小
    "url": "http://example.com/song_from_netease.mp3", // 播放链接
    "source": "netease", // 实际使用的音源
    "proxyUrl": "http://yourproxy.com/http/example.com/song_from_netease.mp3" // 如果适用
  }
}
```

### 6. `GET /search` - 搜索歌曲 (GDStudio API)

**描述:** 在指定的音源上搜索歌曲，支持音源回退和缓存。

**参数:**

| 参数名 | 类型 | 是否必需 | 默认值 (代码内配置) | 描述 |
|--------|------|----------|---------------------|------|
| name | string | 是 | N/A | 搜索关键词 (歌曲名、歌手名、专辑名等)。 |
| source | string | 否 | API_CONFIG.defaultSource | 指定音源。 |
| count | number | 否 | 20 | 每页返回的结果数量。 |
| pages | number | 否 | 1 | 请求的页码。 |

**示例请求:**
```http
GET https://api-unms.axingchen.com/search?name=七里香&source=kugou&count=5
```

**成功响应示例 (200 OK):**
```json
{
  "code": 200,
  "message": "请求成功 (源: kugou)",
  "data": [
    {
      "id": "歌曲ID1",
      "name": "七里香",
      "artist": "周杰伦",
      "album": "七里香",
      "pic_id": "图片ID1_kugou", // 通常是特定于音源的ID
      "lyric_id": "歌词ID1_kugou", // 通常是特定于音源的ID
      "source": "kugou" // 实际使用的音源
    }
    // ...更多歌曲条目...
  ]
}
```

### 7. `GET /pic` - 获取歌曲封面 (GDStudio API)

**描述:** 获取歌曲封面的链接，支持音源回退和缓存。

**参数:**

| 参数名 | 类型 | 是否必需 | 默认值 (代码内配置) | 描述 |
|--------|------|----------|---------------------|------|
| id | string | 是 | N/A | 专辑图的 Pic ID (通常从 /search 结果的 pic_id 字段获取)。 |
| source | string | 否 | API_CONFIG.defaultSource | 指定音源。 |
| size | string | 否 | 300 | 请求的图片尺寸 (300 或 500)。 |

**示例请求:**
```http
GET https://api-unms.axingchen.com/pic?id=图片ID1_kugou&source=kugou&size=500
```

**成功响应示例 (200 OK):**
```json
{
  "code": 200,
  "message": "请求成功 (源: kugou)",
  "data": {
    "url": "http://example.com/album_cover.jpg", // 封面图片链接
    "source": "kugou" // 实际使用的音源
  }
}
```

### 8. `GET /lyric` - 获取歌词 (GDStudio API)

**描述:** 获取歌曲的歌词内容，支持音源回退和缓存。

**参数:**

| 参数名 | 类型 | 是否必需 | 默认值 (代码内配置) | 描述 |
|--------|------|----------|---------------------|------|
| id | string | 是 | N/A | 歌词的 Lyric ID (通常从 /search 结果的 lyric_id 字段获取)。 |
| source | string | 否 | API_CONFIG.defaultSource | 指定音源。 |

**示例请求:**
```http
GET https://api-unms.axingchen.com/lyric?id=歌词ID1_kugou&source=kugou
```

**成功响应示例 (200 OK):**
```json
{
  "code": 200,
  "message": "请求成功 (源: kugou)",
  "data": {
    "lyric": "[00:00.00]歌词第一行\n[00:05.00]歌词第二行...", // LRC 格式的歌词内容
    "tlyric": "[00:00.00]Translated lyric line 1\n[00:05.00]Translated lyric line 2...", // 翻译歌词 (如果存在，否则为 null 或空字符串)
    "source": "kugou" // 实际使用的音源
  }
}
```

## ⚙️ 配置

项目通过根目录下的 `.env` 文件进行配置。在部署到 Vercel 等平台时，请在平台的项目设置中配置这些环境变量。

### 主要环境变量：

#### 基础设置

| 环境变量 | 说明 | 默认值 | 示例 | 是否必需 |
|---------|------|-------|------|---------|
| **PORT** | 服务监听端口 | 5678 | `5678` | 否 |
| **NODE_ENV** | Node.js 运行环境，影响日志级别和JSON美化 | development | `production` | 否 |

#### 安全设置

| 环境变量 | 说明 | 默认值 | 示例 | 是否必需 |
|---------|------|-------|------|---------|
| **ALLOWED_DOMAIN** | CORS 设置，允许访问 API 的前端域名。可以是单个域名、逗号分隔的多个域名，或 `*` 允许所有（不推荐用于生产环境） | * | `https://your-frontend.com` 或 `domain1.com,domain2.com` | 否 |

#### 缓存设置

| 环境变量 | 说明 | 默认值 | 示例 | 是否必需 |
|---------|------|-------|------|---------|
| **CACHE_ENABLED** | 是否启用缓存 | true | `true` 或 `false` | 否 |
| **CACHE_DEFAULT_TTL_SECONDS** | 缓存默认的生存时间（秒） | 3600 | `3600` (1小时) | 否 |

> **注意**：本项目现已实现细化的缓存策略，不同类型的内容有不同的缓存时间：
> - 搜索结果：10 分钟
> - 歌曲链接：1 小时
> - 歌词：6 小时
> - 封面图片：24 小时
> - 测试和匹配结果：1 小时

#### 代理设置

| 环境变量 | 说明 | 默认值 | 示例 | 是否必需 |
|---------|------|-------|------|---------|
| **PROXY_URL** | 反向代理服务器的 URL，用于代理某些音源的 HTTP 链接 | 空 | `https://your-proxy.com/proxy?url=` | 否 |

#### UnblockNeteaseMusic 功能设置

| 环境变量 | 说明 | 默认值 | 示例 | 是否必需 |
|---------|------|-------|------|---------|
| **ENABLE_FLAC** | 是否启用无损音质 | true | `true` 或 `false` | 否 |
| **SELECT_MAX_BR** | 启用无损音质时，是否选择音质最高的 | true | `true` 或 `false` | 否 |
| **FOLLOW_SOURCE_ORDER** | 是否严格按照配置音源设置顺序进行匹配 | true | `true` 或 `false` | 否 |

#### 平台 Cookie 和 API Key

| 环境变量 | 说明 | 默认值 | 示例 | 是否必需 |
|---------|------|-------|------|---------|
| **NETEASE_COOKIE** | 网易云音乐 Cookie | 空 | `MUSIC_U=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx` | 否 |
| **QQ_COOKIE** | QQ音乐 Cookie | 空 | `uin=<your_uin>; qm_keyst=<your_qm_keyst>` | 否 |
| **MIGU_COOKIE** | 咪咕音乐 Cookie | 空 | `aversionid_xxxxxx` | 否 |
| **JOOX_COOKIE** | JOOX Cookie | 空 | `wmid=<your_wmid>; session_key=<your_session_key>` | 否 |
| **YOUTUBE_KEY** | YouTube Data API 密钥 | 空 | `your_api_key` | 否 |

### 配置最佳实践

1. **生产环境安全配置**：
   - 设置 `NODE_ENV=production`
   - 明确指定 `ALLOWED_DOMAIN`，避免使用通配符 `*`
   - 使用 HTTPS 协议的代理服务器

2. **缓存优化**：
   - 保持 `CACHE_ENABLED=true` 以减少对上游服务的请求
   - 根据您的使用场景调整 `CACHE_DEFAULT_TTL_SECONDS`

3. **敏感信息保护**：
   - 不要在代码仓库中提交包含敏感信息的 `.env` 文件
   - 使用部署平台的环境变量或密钥管理功能存储 Cookie 和 API Key
## 🎶 支持音源清单 (用于 /match 和 /test 接口)

此列表基于代码中 UNM_SETTINGS.defaultSources 的默认启用状态。实际可用性可能受网络环境、Cookie配置及上游服务状态影响。

| 名称 | 代号 | 默认启用 (基于配置) | 注意事项 |
|------|------|---------------------|----------|
| QQ 音乐 | qq | ✅ | 需要准备自己的 QQ_COOKIE (环境变量 QQ_COOKIE) |
| 酷狗音乐 | kugou | ✅ |  |
| 酷我音乐 | kuwo | ✅ |  |
| 咪咕音乐 | migu | ✅ | 需要准备自己的 MIGU_COOKIE (环境变量 MIGU_COOKIE) |
| JOOX | joox |  | 需要准备自己的 JOOX_COOKIE (环境变量 JOOX_COOKIE)，似乎有严格地区限制。 |
| YouTube（纯 JS 解析方式） | youtube | ✅ | 需要 Google 认定的非中国大陆区域 IP 地址。 |
| B 站音乐 | bilibili | ✅ |  |
| 第三方网易云 API | pyncmd | ✅ |  |
| YouTube（通过 youtube-dl) | youtube-dl | ✅ | 需要在服务器环境自行安装 youtube-dl。 |
| YouTube（通过 yt-dlp) | yt-dlp | ✅ | 需要在服务器环境自行安装 yt-dlp（youtube-dl 的活跃 fork）。 |
| ~~yt-download~~ | ytdownload |  | 此音源在库中可能已废弃或不可用。 |

**注：** 默认启用列的 ✅ 表示该音源包含在代码的 UNM_SETTINGS.defaultSources 数组中。未标记的音源仍可通过 /match 接口的 server 参数指定使用。
## 🔗 关于反向代理

部分音源返回的播放链接可能是 http 协议，在 https 协议的前端页面中直接使用可能会因混合内容（Mixed Content）而被浏览器阻止。

如果遇到此问题，您可以：

* **使用本项目内置的代理尝试**：如果 PROXY_URL 环境变量已配置，对于来自 kuwo.cn 或 kugou.com 的特定链接，服务会尝试在响应的 data 对象中额外提供一个 proxyUrl 字段。
* **自行部署通用反向代理服务**:
  * 例如 netptop/siteproxy 或其他支持代理任意 URL 的服务 (如 Nginx, Caddy 等)。
  * 将您部署的代理服务地址配置到本项目的 PROXY_URL 环境变量中，以供上述特定链接自动生成 proxyUrl。
  * 对于其他不自动生成 proxyUrl 的链接，或您希望代理所有链接，客户端也可以考虑自行将获取到的原始 url 通过您的通用反向代理服务进行中转。
## 📝 未来计划 (Todo)

* [ ] **代码语言迁移**: 将项目从 JavaScript 迁移到 TypeScript，以增强代码健壮性和可维护性。
* [ ] **测试覆盖**: 为核心逻辑和API端点编写单元测试和集成测试。
* [x] **更细致的缓存策略**: 为不同类型的API配置不同的缓存TTL。
* [ ] **Docker 化**: 提供 Dockerfile 以方便容器化部署。
* [x] **请求频率限制**: 实现基础的速率限制以保护服务。
* [x] **增强 CORS 设置**: 支持多域名配置，限制允许的 HTTP 方法。
* [x] **XSS 防护**: 添加安全头信息，使用 helmet 中间件。
* [x] **JSON 响应优化**: 在生产环境中使用紧凑 JSON 格式减少响应体积。
* [x] **配置验证**: 在应用启动时验证环境变量，提供明确的错误信息。
## 🤝 贡献

如果您有任何改进建议或发现任何问题，欢迎通过提交 Pull Requests 或 Issues 的方式参与到项目中来！

## 📄 开源许可

本项目基于 MIT License 开源。
