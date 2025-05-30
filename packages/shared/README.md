# @unm/shared

UNM-Server V2 共享类型定义和工具函数包。

## 📦 包含内容

### 🔧 类型定义 (types.ts)
- **API响应类型**: `ApiResponse<T>`, `ServiceResponse<T>`, `PaginatedResponse<T>`
- **音乐相关类型**: `SongInfo`, `SongUrl`, `SearchResult`, `Lyric`, `PicInfo`
- **配置类型**: `AppConfig`, `CacheConfig`, `UnmConfig`, `GdStudioConfig`
- **枚举类型**: `MusicSource`, `AudioQuality`, `AudioFormat`, `SearchType`
- **请求参数类型**: `UrlRequest`, `SearchRequest`, `PicRequest`, `LyricRequest`

### 🛠️ 工具函数 (utils.ts)
- **响应创建**: `createSuccessResponse()`, `createErrorResponse()`
- **环境变量**: `getEnvVar()`, `getEnvNumber()`, `getEnvBoolean()`
- **字符串处理**: `cleanPath()`, `formatFileSize()`, `formatDuration()`
- **异步工具**: `delay()`, `retry()`, `withTimeout()`
- **数据处理**: `deepClone()`, `objectDiff()`, `uniqueArray()`, `chunkArray()`
- **缓存工具**: `generateCacheKey()`, `calculateMD5()`
- **函数式工具**: `debounce()`, `throttle()`

### 📋 常量定义 (constants.ts)
- **应用信息**: `APP_INFO`, `API_VERSION`
- **HTTP状态码**: `HTTP_STATUS`
- **缓存TTL**: `CACHE_TTL`
- **速率限制**: `RATE_LIMIT`
- **音乐源**: `MUSIC_SOURCES`
- **错误/成功消息**: `ERROR_MESSAGES`, `SUCCESS_MESSAGES`
- **API路径**: `API_PATHS`

### ✅ 验证器 (validators.ts)
- **基础验证器**: `StringValidators`, `NumberValidators`, `EnumValidators`
- **复合验证器**: `PaginationValidator`, `SearchValidator`, `SongUrlValidator`
- **响应验证器**: `ApiResponseValidator`, `SongInfoValidator`
- **配置验证器**: `AppConfigValidator`, `CacheConfigValidator`
- **验证工具**: `safeValidate()`, `validateAndTransform()`, `validateBatch()`

## 🚀 使用示例

### 类型定义使用

```typescript
import type { ApiResponse, SongInfo, MusicSource } from '@unm/shared';

// API响应类型
const response: ApiResponse<SongInfo[]> = {
  code: 200,
  message: '搜索成功',
  data: [
    {
      id: '123456',
      name: '青花瓷',
      artist: '周杰伦',
      source: 'netease'
    }
  ],
  timestamp: Date.now()
};

// 音乐源类型
const source: MusicSource = 'netease';
```

### 工具函数使用

```typescript
import { 
  createSuccessResponse, 
  createErrorResponse,
  retry,
  generateCacheKey,
  formatDuration 
} from '@unm/shared';

// 创建响应
const success = createSuccessResponse({ id: '123' }, '获取成功');
const error = createErrorResponse('未找到资源', 404);

// 重试机制
const result = await retry(async () => {
  return await fetchSongInfo('123456');
}, 3, 1000);

// 缓存键生成
const cacheKey = generateCacheKey('song', 'netease', '123456');

// 时间格式化
const duration = formatDuration(238); // "3:58"
```

### 常量使用

```typescript
import { 
  HTTP_STATUS, 
  CACHE_TTL, 
  MUSIC_SOURCES, 
  ERROR_MESSAGES 
} from '@unm/shared';

// HTTP状态码
if (response.status === HTTP_STATUS.NOT_FOUND) {
  throw new Error(ERROR_MESSAGES.NOT_FOUND);
}

// 缓存TTL
const ttl = CACHE_TTL.SEARCH; // 600秒

// 音乐源
const defaultSource = MUSIC_SOURCES.NETEASE; // 'netease'
```

### 验证器使用

```typescript
import { 
  SearchValidator, 
  SongUrlValidator,
  safeValidate,
  validateAndTransform 
} from '@unm/shared';

// 参数验证
const searchParams = SearchValidator.parse({
  keyword: '周杰伦',
  page: 1,
  limit: 20
});

// 安全验证
const result = safeValidate(SongUrlValidator, {
  id: '123456',
  quality: '320'
});

if (result.success) {
  console.log('验证成功:', result.data);
} else {
  console.error('验证失败:', result.error);
}

// 验证并转换
const urlParams = validateAndTransform(
  SongUrlValidator,
  requestData,
  '歌曲URL参数无效'
);
```

## 🔄 Zod Schema

所有验证器都基于 [Zod](https://zod.dev/) 构建，提供：

- **运行时类型验证**
- **类型推断**
- **错误消息定制**
- **数据转换**
- **组合验证**

```typescript
import { z } from 'zod';
import { MusicSourceSchema, SongInfoSchema } from '@unm/shared';

// 扩展现有Schema
const ExtendedSongSchema = SongInfoSchema.extend({
  playCount: z.number().optional(),
  tags: z.array(z.string()).optional()
});

// 组合Schema
const SearchResponseSchema = z.object({
  songs: z.array(SongInfoSchema),
  total: z.number(),
  hasMore: z.boolean()
});
```

## 📝 类型安全

包提供完整的TypeScript类型支持：

```typescript
// 编译时类型检查
const song: SongInfo = {
  id: '123',
  name: '歌曲名',
  artist: '艺术家'
  // TypeScript会检查必需字段
};

// 泛型支持
const response: ApiResponse<SongInfo[]> = createSuccessResponse(songs);

// 枚举约束
const source: MusicSource = 'netease'; // 只能是预定义的值
```

## 🧪 测试

包含完整的类型测试套件：

```bash
# 运行类型测试
pnpm test

# 类型检查
pnpm typecheck

# 代码检查
pnpm lint
```

## 📚 API文档

详细的API文档请参考：
- [类型定义文档](./src/types.ts)
- [工具函数文档](./src/utils.ts)
- [常量定义文档](./src/constants.ts)
- [验证器文档](./src/validators.ts)

## 🔗 相关包

- `@unm/config` - 配置管理
- `@unm/api` - API服务
- `@unm/web` - 前端应用
