import { z } from 'zod';

// API响应基础结构
export const ApiResponseSchema = z.object({
  code: z.number(),
  message: z.string(),
  data: z.unknown().nullable(),
  timestamp: z.number().optional(),
  requestId: z.string().optional(),
});

export type ApiResponse<T = unknown> = {
  code: number;
  message: string;
  data: T | null;
  timestamp?: number;
  requestId?: string;
};

// 音乐源类型
export const MusicSourceSchema = z.enum([
  'netease',
  'tencent',
  'tidal',
  'spotify',
  'ytmusic',
  'qobuz',
  'joox',
  'deezer',
  'migu',
  'kugou',
  'kuwo',
  'ximalaya',
]);

export type MusicSource = z.infer<typeof MusicSourceSchema>;

// 歌曲信息
export const SongInfoSchema = z.object({
  id: z.string(),
  name: z.string(),
  artist: z.string(),
  album: z.string().optional(),
  duration: z.number().optional(),
  pic_id: z.string().optional(),
  lyric_id: z.string().optional(),
  source: MusicSourceSchema.optional(),
});

export type SongInfo = z.infer<typeof SongInfoSchema>;

// 歌曲URL信息
export const SongUrlSchema = z.object({
  id: z.string(),
  url: z.string(),
  br: z.number().optional(),
  size: z.number().optional(),
  type: z.string().optional(),
  md5: z.string().optional(),
  source: MusicSourceSchema.optional(),
  proxyUrl: z.string().optional(),
});

export type SongUrl = z.infer<typeof SongUrlSchema>;

// 搜索结果
export const SearchResultSchema = z.array(SongInfoSchema);
export type SearchResult = z.infer<typeof SearchResultSchema>;

// 歌词信息
export const LyricSchema = z.object({
  lyric: z.string(),
  tlyric: z.string().optional(),
  source: MusicSourceSchema.optional(),
});

export type Lyric = z.infer<typeof LyricSchema>;

// 图片信息
export const PicInfoSchema = z.object({
  url: z.string(),
  source: MusicSourceSchema.optional(),
});

export type PicInfo = z.infer<typeof PicInfoSchema>;

// API请求参数
export const UrlRequestSchema = z.object({
  id: z.string(),
  br: z.enum(['128', '192', '320', '740', '999']).default('999'),
  source: MusicSourceSchema.optional(),
});

export const SearchRequestSchema = z.object({
  name: z.string(),
  count: z.coerce.number().min(1).max(100).default(20),
  pages: z.coerce.number().min(1).default(1),
  source: MusicSourceSchema.optional(),
});

export const PicRequestSchema = z.object({
  id: z.string(),
  size: z.enum(['300', '500']).default('300'),
  source: MusicSourceSchema.optional(),
});

export const LyricRequestSchema = z.object({
  id: z.string(),
  source: MusicSourceSchema.optional(),
});

export const MatchRequestSchema = z.object({
  id: z.string(),
  server: z.string().optional(),
});

export type UrlRequest = z.infer<typeof UrlRequestSchema>;
export type SearchRequest = z.infer<typeof SearchRequestSchema>;
export type PicRequest = z.infer<typeof PicRequestSchema>;
export type LyricRequest = z.infer<typeof LyricRequestSchema>;
export type MatchRequest = z.infer<typeof MatchRequestSchema>;

// 错误类型
export class ApiError extends Error {
  constructor(
    public code: number,
    message: string,
    public data?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// 配置类型
export interface AppConfig {
  port: number;
  nodeEnv: string;
  isProduction: boolean;
  allowedDomain: string | string[];
  cacheEnabled: boolean;
  cacheDefaultTTL: number;
  proxyUrl?: string | undefined;
  databaseUrl?: string | undefined;
  redisUrl?: string | undefined;
}

// 缓存配置
export interface CacheConfig {
  enabled: boolean;
  defaultTTL: number;
  ttlConfig: Record<string, number>;
}

// UNM配置
export interface UnmConfig {
  defaultSources: string[];
  testSongId: string;
}

// GDStudio API配置
export interface GdStudioConfig {
  baseUrl: string;
  defaultSource: MusicSource;
  validSources: MusicSource[];
  fallbackSource: MusicSource;
  requestTimeout: number;
}

// HTTP状态码类型
export type HttpStatusCode = 200 | 201 | 400 | 401 | 403 | 404 | 429 | 500 | 502 | 503;

// 日志级别
export enum LogLevel {
  ERROR = 'error',
  WARN = 'warn',
  INFO = 'info',
  DEBUG = 'debug',
}

// 缓存键类型
export type CacheKey = `${string}:${string}` | string;

// 服务响应类型
export interface ServiceResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  statusCode?: HttpStatusCode;
}

// 分页参数
export const PaginationSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  offset: z.coerce.number().min(0).optional(),
});

export type PaginationParams = z.infer<typeof PaginationSchema>;

// 分页响应
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

// 音质类型
export enum AudioQuality {
  LOW = '128',
  MEDIUM = '192',
  HIGH = '320',
  LOSSLESS = '740',
  HIRES = '999',
}

// 音乐文件格式
export enum AudioFormat {
  MP3 = 'mp3',
  FLAC = 'flac',
  AAC = 'aac',
  OGG = 'ogg',
  WAV = 'wav',
}

// 艺术家信息
export const ArtistSchema = z.object({
  id: z.string(),
  name: z.string(),
  alias: z.array(z.string()).optional(),
  picUrl: z.string().optional(),
  source: MusicSourceSchema.optional(),
});

export type Artist = z.infer<typeof ArtistSchema>;

// 专辑信息
export const AlbumSchema = z.object({
  id: z.string(),
  name: z.string(),
  artist: z.string(),
  picUrl: z.string().optional(),
  publishTime: z.string().optional(),
  source: MusicSourceSchema.optional(),
});

export type Album = z.infer<typeof AlbumSchema>;

// 播放列表信息
export const PlaylistSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  coverUrl: z.string().optional(),
  trackCount: z.number().optional(),
  creator: z.string().optional(),
  source: MusicSourceSchema.optional(),
});

export type Playlist = z.infer<typeof PlaylistSchema>;

// 搜索类型
export enum SearchType {
  SONG = 'song',
  ARTIST = 'artist',
  ALBUM = 'album',
  PLAYLIST = 'playlist',
}

// 扩展的搜索请求
export const ExtendedSearchRequestSchema = z.object({
  keyword: z.string(),
  type: z.nativeEnum(SearchType).default(SearchType.SONG),
  count: z.coerce.number().min(1).max(100).default(20),
  page: z.coerce.number().min(1).default(1),
  source: MusicSourceSchema.optional(),
});

export type ExtendedSearchRequest = z.infer<typeof ExtendedSearchRequestSchema>;

// API统计信息
export interface ApiStats {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  uptime: number;
  lastResetTime: string;
}

// 健康检查响应
export interface HealthCheckResponse {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: string;
  uptime: number;
  memory: NodeJS.MemoryUsage;
  services: Record<string, 'up' | 'down' | 'unknown'>;
  version: string;
}

// 缓存接口
export interface CacheService {
  get<T>(key: string): Promise<T | null>;
  set(key: string, value: any, ttl?: number): Promise<void>;
  del(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
  clear(): Promise<void>;
  keys(pattern: string): Promise<string[]>;
  ttl(key: string): Promise<number>;
  expire(key: string, ttl: number): Promise<void>;
  close(): Promise<void>;
  isHealthy(): boolean;
  getStats(): CacheStats;
  resetStats(): void;
}

// Redis配置
export interface RedisConfig {
  url?: string;
  host?: string;
  port?: number;
  password?: string;
  db?: number;
  maxRetriesPerRequest?: number;
  retryDelayOnFailover?: number;
  enableReadyCheck?: boolean;
  lazyConnect?: boolean;
  keepAlive?: number;
  family?: number;
  keyPrefix?: string;
}

// 缓存策略
export enum CacheStrategy {
  CACHE_FIRST = 'cache-first',
  CACHE_ASIDE = 'cache-aside',
  WRITE_THROUGH = 'write-through',
  WRITE_BEHIND = 'write-behind',
  REFRESH_AHEAD = 'refresh-ahead',
}

// 缓存统计
export interface CacheStats {
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
  errors: number;
  hitRate: number;
  totalOperations: number;
  lastResetTime: string;
}
