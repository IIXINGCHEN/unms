import { z } from 'zod';
// API响应基础结构
export const ApiResponseSchema = z.object({
  code: z.number(),
  message: z.string(),
  data: z.unknown().nullable(),
  timestamp: z.number().optional(),
  requestId: z.string().optional(),
});
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
// 搜索结果
export const SearchResultSchema = z.array(SongInfoSchema);
// 歌词信息
export const LyricSchema = z.object({
  lyric: z.string(),
  tlyric: z.string().optional(),
  source: MusicSourceSchema.optional(),
});
// 图片信息
export const PicInfoSchema = z.object({
  url: z.string(),
  source: MusicSourceSchema.optional(),
});
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
// 错误类型
export class ApiError extends Error {
  code;
  data;
  constructor(code, message, data) {
    super(message);
    this.code = code;
    this.data = data;
    this.name = 'ApiError';
  }
}
//# sourceMappingURL=types.js.map
