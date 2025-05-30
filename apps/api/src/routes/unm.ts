import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';

import { createErrorResponse, createSuccessResponse, MatchRequestSchema } from '../../../../packages/shared/dist/index.js';
import { unmService } from '../services/unm.js';

export const unmRoutes = new Hono();

// UNM功能测试
unmRoutes.get('/test', async (c) => {
  try {
    const result = await unmService.test();
    
    return c.json(createSuccessResponse(result, 'UNM测试完成'));
  } catch (error) {
    console.error('UNM测试失败:', error);
    return c.json(createErrorResponse('UNM测试失败', 500), { status: 500 });
  }
});

// 歌曲匹配
unmRoutes.get('/match', zValidator('query', MatchRequestSchema), async (c) => {
  try {
    const { id, server } = c.req.valid('query');
    
    const result = await unmService.match(id, server);
    
    if (!result || !result.url) {
      return c.json(createErrorResponse('未找到匹配的歌曲', 404), { status: 404 });
    }
    
    return c.json(createSuccessResponse(result, '匹配成功'));
  } catch (error) {
    console.error('歌曲匹配失败:', error);
    return c.json(createErrorResponse('歌曲匹配失败', 500), { status: 500 });
  }
});
