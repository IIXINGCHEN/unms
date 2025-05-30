import { z } from 'zod';
import { REGEX, MUSIC_SOURCES, AUDIO_QUALITY, IMAGE_SIZES, SEARCH_TYPES } from './constants';

/**
 * 基础验证器
 */

// 字符串验证
export const StringValidators = {
  nonEmpty: z.string().min(1, '不能为空'),
  email: z.string().regex(REGEX.EMAIL, '邮箱格式无效'),
  url: z.string().regex(REGEX.URL, 'URL格式无效'),
  songId: z.string().regex(REGEX.SONG_ID, '歌曲ID格式无效'),
  md5: z.string().regex(REGEX.MD5, 'MD5格式无效'),
  uuid: z.string().regex(REGEX.UUID, 'UUID格式无效'),
} as const;

// 数字验证
export const NumberValidators = {
  positiveInt: z.number().int().positive('必须是正整数'),
  nonNegativeInt: z.number().int().min(0, '不能为负数'),
  port: z.number().int().min(1).max(65535, '端口号必须在1-65535之间'),
  percentage: z.number().min(0).max(100, '百分比必须在0-100之间'),
  timestamp: z.number().int().positive('时间戳必须是正整数'),
} as const;

// 枚举验证
export const EnumValidators = {
  musicSource: z.enum(Object.values(MUSIC_SOURCES) as [string, ...string[]], {
    errorMap: () => ({ message: '不支持的音乐源' }),
  }),
  audioQuality: z.enum(Object.values(AUDIO_QUALITY) as [string, ...string[]], {
    errorMap: () => ({ message: '不支持的音质' }),
  }),
  imageSize: z.enum(Object.values(IMAGE_SIZES) as [string, ...string[]], {
    errorMap: () => ({ message: '不支持的图片尺寸' }),
  }),
  searchType: z.enum(Object.values(SEARCH_TYPES) as [string, ...string[]], {
    errorMap: () => ({ message: '不支持的搜索类型' }),
  }),
} as const;

/**
 * 复合验证器
 */

// 分页参数验证
export const PaginationValidator = z.object({
  page: z.coerce.number().int().min(1, '页码必须大于0').default(1),
  limit: z.coerce.number().int().min(1).max(100, '每页数量必须在1-100之间').default(20),
  offset: z.coerce.number().int().min(0, '偏移量不能为负数').optional(),
});

// 搜索参数验证
export const SearchValidator = z.object({
  keyword: StringValidators.nonEmpty,
  type: EnumValidators.searchType.default(SEARCH_TYPES.SONG),
  source: EnumValidators.musicSource.optional(),
}).merge(PaginationValidator.omit({ offset: true }));

// 歌曲URL参数验证
export const SongUrlValidator = z.object({
  id: StringValidators.songId,
  quality: EnumValidators.audioQuality.default(AUDIO_QUALITY.HIRES),
  source: EnumValidators.musicSource.optional(),
});

// 歌词参数验证
export const LyricValidator = z.object({
  id: StringValidators.songId,
  source: EnumValidators.musicSource.optional(),
});

// 图片参数验证
export const PicValidator = z.object({
  id: StringValidators.songId,
  size: EnumValidators.imageSize.default(IMAGE_SIZES.SMALL),
  source: EnumValidators.musicSource.optional(),
});

// 匹配参数验证
export const MatchValidator = z.object({
  id: StringValidators.songId,
  sources: z.string().optional().transform((val: string | undefined) => {
    if (!val) return undefined;
    return val.split(',').map((s: string) => s.trim()).filter(Boolean);
  }),
});

/**
 * 响应验证器
 */

// API响应验证
export const ApiResponseValidator = z.object({
  code: NumberValidators.nonNegativeInt,
  message: z.string(),
  data: z.unknown().nullable(),
  timestamp: NumberValidators.timestamp.optional(),
  requestId: z.string().optional(),
});

// 歌曲信息验证
export const SongInfoValidator = z.object({
  id: StringValidators.songId,
  name: StringValidators.nonEmpty,
  artist: z.string(),
  album: z.string().optional(),
  duration: NumberValidators.positiveInt.optional(),
  picId: StringValidators.songId.optional(),
  lyricId: StringValidators.songId.optional(),
  source: EnumValidators.musicSource.optional(),
});

// 歌曲URL验证
export const SongUrlResponseValidator = z.object({
  id: StringValidators.songId,
  url: StringValidators.url,
  quality: EnumValidators.audioQuality.optional(),
  size: NumberValidators.positiveInt.optional(),
  format: z.string().optional(),
  md5: StringValidators.md5.optional(),
  source: EnumValidators.musicSource.optional(),
  proxyUrl: StringValidators.url.optional(),
});

// 歌词验证
export const LyricResponseValidator = z.object({
  lyric: z.string(),
  translatedLyric: z.string().optional(),
  source: EnumValidators.musicSource.optional(),
});

// 图片验证
export const PicResponseValidator = z.object({
  url: StringValidators.url,
  size: EnumValidators.imageSize.optional(),
  source: EnumValidators.musicSource.optional(),
});

/**
 * 配置验证器
 */

// 应用配置验证
export const AppConfigValidator = z.object({
  port: NumberValidators.port,
  nodeEnv: z.enum(['development', 'production', 'test']),
  isProduction: z.boolean(),
  allowedDomain: z.union([z.string(), z.array(z.string())]),
  cacheEnabled: z.boolean(),
  cacheDefaultTTL: NumberValidators.positiveInt,
  proxyUrl: StringValidators.url.optional(),
  databaseUrl: z.string().optional(),
  redisUrl: z.string().optional(),
});

// 缓存配置验证
export const CacheConfigValidator = z.object({
  enabled: z.boolean(),
  defaultTTL: NumberValidators.positiveInt,
  ttlConfig: z.record(z.string(), NumberValidators.positiveInt),
});

/**
 * 验证工具函数
 */

/**
 * 安全验证函数 - 不抛出异常
 */
export function safeValidate<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; error: z.ZodError } {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error };
}

/**
 * 验证并转换数据
 */
export function validateAndTransform<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
  errorMessage?: string
): T {
  try {
    return schema.parse(data);
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      const message = errorMessage || '数据验证失败';
      const details = error.errors.map((e: z.ZodIssue) => `${e.path.join('.')}: ${e.message}`).join(', ');
      throw new Error(`${message}: ${details}`);
    }
    throw error;
  }
}

/**
 * 批量验证
 */
export function validateBatch<T>(
  schema: z.ZodSchema<T>,
  dataArray: unknown[]
): { valid: T[]; invalid: { index: number; data: unknown; error: z.ZodError }[] } {
  const valid: T[] = [];
  const invalid: { index: number; data: unknown; error: z.ZodError }[] = [];

  dataArray.forEach((data, index) => {
    const result = safeValidate(schema, data);
    if (result.success) {
      valid.push(result.data as T);
    } else {
      invalid.push({ index, data, error: result.error });
    }
  });

  return { valid, invalid };
}

/**
 * 创建自定义验证器
 */
export function createCustomValidator<T>(
  baseSchema: z.ZodSchema<T>,
  customValidation: (data: T) => boolean | string
): z.ZodSchema<T> {
  return baseSchema.refine(customValidation, {
    message: typeof customValidation === 'string' ? customValidation : '自定义验证失败',
  });
}
