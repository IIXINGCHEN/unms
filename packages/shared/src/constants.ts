/**
 * 应用常量定义
 */

// 应用信息
export const APP_INFO = {
  NAME: 'UNM-Server V2',
  VERSION: '2.0.0',
  DESCRIPTION: '现代化音乐API服务',
  AUTHOR: 'UNM-Server Team',
  LICENSE: 'MIT',
} as const;

// API版本
export const API_VERSION = {
  V1: 'v1',
  V2: 'v2',
  CURRENT: 'v2',
} as const;

// HTTP状态码
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  METHOD_NOT_ALLOWED: 405,
  CONFLICT: 409,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503,
  GATEWAY_TIMEOUT: 504,
} as const;

// 缓存TTL配置（秒）
export const CACHE_TTL = {
  SEARCH: 10 * 60,        // 搜索结果：10分钟
  URL: 60 * 60,           // 歌曲链接：1小时
  LYRIC: 6 * 60 * 60,     // 歌词：6小时
  PIC: 24 * 60 * 60,      // 封面图片：24小时
  TEST: 60 * 60,          // 测试结果：1小时
  MATCH: 60 * 60,         // 匹配结果：1小时
  DEFAULT: 60 * 60,       // 默认：1小时
  SHORT: 5 * 60,          // 短期：5分钟
  LONG: 7 * 24 * 60 * 60, // 长期：7天
} as const;

// 速率限制配置
export const RATE_LIMIT = {
  GLOBAL: {
    WINDOW_MS: 60 * 1000,   // 1分钟
    MAX_REQUESTS: 60,       // 60次请求
  },
  SENSITIVE: {
    WINDOW_MS: 60 * 1000,   // 1分钟
    MAX_REQUESTS: 30,       // 30次请求
  },
  STRICT: {
    WINDOW_MS: 60 * 1000,   // 1分钟
    MAX_REQUESTS: 10,       // 10次请求
  },
} as const;

// 音乐源配置
export const MUSIC_SOURCES = {
  NETEASE: 'netease',
  TENCENT: 'tencent',
  TIDAL: 'tidal',
  SPOTIFY: 'spotify',
  YTMUSIC: 'ytmusic',
  QOBUZ: 'qobuz',
  JOOX: 'joox',
  DEEZER: 'deezer',
  MIGU: 'migu',
  KUGOU: 'kugou',
  KUWO: 'kuwo',
  XIMALAYA: 'ximalaya',
} as const;

// 音质配置
export const AUDIO_QUALITY = {
  LOW: '128',
  MEDIUM: '192',
  HIGH: '320',
  LOSSLESS: '740',
  HIRES: '999',
} as const;

// 文件格式
export const AUDIO_FORMATS = {
  MP3: 'mp3',
  FLAC: 'flac',
  AAC: 'aac',
  OGG: 'ogg',
  WAV: 'wav',
} as const;

// 图片尺寸
export const IMAGE_SIZES = {
  SMALL: '300',
  MEDIUM: '500',
  LARGE: '800',
  ORIGINAL: 'original',
} as const;

// 搜索类型
export const SEARCH_TYPES = {
  SONG: 'song',
  ARTIST: 'artist',
  ALBUM: 'album',
  PLAYLIST: 'playlist',
} as const;

// 日志级别
export const LOG_LEVELS = {
  ERROR: 'error',
  WARN: 'warn',
  INFO: 'info',
  DEBUG: 'debug',
} as const;

// 环境类型
export const ENVIRONMENTS = {
  DEVELOPMENT: 'development',
  PRODUCTION: 'production',
  TEST: 'test',
} as const;

// 默认配置值
export const DEFAULTS = {
  PORT: 5678,
  CACHE_TTL: 3600,
  REQUEST_TIMEOUT: 10000,
  SEARCH_LIMIT: 20,
  MAX_SEARCH_LIMIT: 100,
  PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,
} as const;

// 错误消息
export const ERROR_MESSAGES = {
  INVALID_PARAMS: '请求参数无效',
  NOT_FOUND: '请求的资源未找到',
  INTERNAL_ERROR: '服务器内部错误',
  RATE_LIMITED: '请求过于频繁，请稍后再试',
  UNAUTHORIZED: '未授权访问',
  FORBIDDEN: '禁止访问',
  TIMEOUT: '请求超时',
  SERVICE_UNAVAILABLE: '服务暂时不可用',
  VALIDATION_FAILED: '参数验证失败',
  SONG_NOT_FOUND: '未找到歌曲',
  LYRIC_NOT_FOUND: '未找到歌词',
  PIC_NOT_FOUND: '未找到封面图片',
  SEARCH_FAILED: '搜索失败',
  MATCH_FAILED: '歌曲匹配失败',
  UNM_TEST_FAILED: 'UNM测试失败',
} as const;

// 成功消息
export const SUCCESS_MESSAGES = {
  OK: '请求成功',
  SEARCH_SUCCESS: '搜索成功',
  URL_SUCCESS: '获取播放链接成功',
  LYRIC_SUCCESS: '获取歌词成功',
  PIC_SUCCESS: '获取封面成功',
  MATCH_SUCCESS: '匹配成功',
  UNM_TEST_SUCCESS: 'UNM测试完成',
  API_INFO_SUCCESS: 'API信息获取成功',
  API_DETAIL_SUCCESS: 'API详细信息获取成功',
  HEALTH_CHECK_SUCCESS: '服务健康',
} as const;

// 请求头
export const HEADERS = {
  USER_AGENT: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  ACCEPT: 'application/json, text/plain, */*',
  ACCEPT_LANGUAGE: 'zh-CN,zh;q=0.9,en;q=0.8',
  ACCEPT_ENCODING: 'gzip, deflate, br',
  CONNECTION: 'keep-alive',
  REFERER: 'https://music.163.com/',
  CONTENT_TYPE_JSON: 'application/json',
  CONTENT_TYPE_FORM: 'application/x-www-form-urlencoded',
} as const;

// 正则表达式
export const REGEX = {
  EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  URL: /^https?:\/\/.+/,
  SONG_ID: /^\d+$/,
  MD5: /^[a-f0-9]{32}$/i,
  UUID: /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
} as const;

// UNM默认音源
export const UNM_DEFAULT_SOURCES = [
  'pyncmd',
  'kuwo',
  'bilibili',
  'migu',
  'kugou',
  'qq',
  'youtube',
  'youtube-dl',
  'yt-dlp',
] as const;

// API端点路径
export const API_PATHS = {
  ROOT: '/',
  HEALTH: '/health',
  API_INFO: '/api',
  API_DETAIL: '/api/info',
  API_DOCS: '/api/docs',
  MUSIC: {
    BASE: '/api/music',
    SEARCH: '/api/music/search',
    URL: '/api/music/url',
    LYRIC: '/api/music/lyric',
    PIC: '/api/music/pic',
  },
  UNM: {
    BASE: '/api/unm',
    TEST: '/api/unm/test',
    MATCH: '/api/unm/match',
  },
} as const;
