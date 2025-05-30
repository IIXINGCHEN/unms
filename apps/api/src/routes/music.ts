import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';

import { createErrorResponse, createSuccessResponse, UrlRequestSchema, SearchRequestSchema, PicRequestSchema, LyricRequestSchema } from '../../../../packages/shared/dist/index.js';
import { gdStudioService } from '../services/gdstudio.js';
import { musicCacheMiddleware } from '../middleware/cache.js';

export const musicRoutes = new Hono();

// 应用音乐API缓存中间件
musicRoutes.use('*', musicCacheMiddleware());

// 获取歌曲播放链接
musicRoutes.get('/url', zValidator('query', UrlRequestSchema), async (c) => {
  try {
    const { id, br = '999', source } = c.req.valid('query');

    const result = await gdStudioService.getUrl(id, br, source);

    if (!result || !result.url) {
      return c.json(createErrorResponse('未找到歌曲播放链接', 404), { status: 404 });
    }

    return c.json(createSuccessResponse(result, '获取播放链接成功'));
  } catch (error) {
    console.error('获取播放链接失败:', error);
    return c.json(createErrorResponse('获取播放链接失败', 500), { status: 500 });
  }
});

// 搜索歌曲
musicRoutes.get('/search', zValidator('query', SearchRequestSchema), async (c) => {
  try {
    const { name, count = 20, pages = 1, source } = c.req.valid('query');

    const result = await gdStudioService.search(name, count, pages, source);

    if (!result || result.length === 0) {
      return c.json(createErrorResponse('未找到相关歌曲', 404), { status: 404 });
    }

    return c.json(createSuccessResponse(result, '搜索成功'));
  } catch (error) {
    console.error('搜索失败:', error);
    return c.json(createErrorResponse('搜索失败', 500), { status: 500 });
  }
});

// 获取歌曲封面
musicRoutes.get('/pic', zValidator('query', PicRequestSchema), async (c) => {
  try {
    const { id, size = '300', source } = c.req.valid('query');

    const result = await gdStudioService.getPic(id, size, source);

    if (!result || !result.url) {
      return c.json(createErrorResponse('未找到封面图片', 404), { status: 404 });
    }

    return c.json(createSuccessResponse(result, '获取封面成功'));
  } catch (error) {
    console.error('获取封面失败:', error);
    return c.json(createErrorResponse('获取封面失败', 500), { status: 500 });
  }
});

// 获取歌词
musicRoutes.get('/lyric', zValidator('query', LyricRequestSchema), async (c) => {
  try {
    const { id, source } = c.req.valid('query');

    const result = await gdStudioService.getLyric(id, source);

    if (!result || !result.lyric) {
      return c.json(createErrorResponse('未找到歌词', 404), { status: 404 });
    }

    return c.json(createSuccessResponse(result, '获取歌词成功'));
  } catch (error) {
    console.error('获取歌词失败:', error);
    return c.json(createErrorResponse('获取歌词失败', 500), { status: 500 });
  }
});
