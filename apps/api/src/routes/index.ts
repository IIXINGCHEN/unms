import { Hono } from 'hono';

import { createSuccessResponse } from '@unm/shared';

import { musicRoutes } from './music.js';
import { unmRoutes } from './unm.js';

export const apiRoutes = new Hono();

// API信息路由
apiRoutes.get('/', (c) => {
  const apiInfo = {
    name: 'UNM-Server V2 API',
    version: '2.0.0',
    description: '现代化音乐API服务',
    endpoints: {
      music: {
        url: '/api/music/url',
        search: '/api/music/search',
        pic: '/api/music/pic',
        lyric: '/api/music/lyric',
      },
      unm: {
        test: '/api/unm/test',
        match: '/api/unm/match',
      },
      system: {
        health: '/health',
        info: '/api/info',
      },
    },
    documentation: '/api/docs',
  };

  return c.json(createSuccessResponse(apiInfo, 'API信息获取成功'));
});

// 详细信息路由
apiRoutes.get('/info', async (c) => {
  const configModule = await import('@unm/config');
  const configs = configModule.loadAllConfigs();

  const infoPayload = {
    version: '2.0.0',
    environment: configs.app.nodeEnv,
    cache_enabled: configs.cache.enabled,
    cache_default_ttl: configs.cache.defaultTTL,
    proxy_enabled: !!configs.app.proxyUrl,
    gd_api_default_source: configs.gdstudio.defaultSource,
    gd_api_fallback_source: configs.gdstudio.fallbackSource,
    gd_api_valid_sources: configs.gdstudio.validSources,
    unm_test_song_id: configs.unm.testSongId,
    uptime: process.uptime(),
    memory: process.memoryUsage(),
  };

  return c.json(createSuccessResponse(infoPayload, 'API详细信息获取成功'));
});

// 挂载子路由
apiRoutes.route('/music', musicRoutes);
apiRoutes.route('/unm', unmRoutes);

// API文档路由（简单版本）
apiRoutes.get('/docs', (c) => {
  const html = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>UNM-Server V2 API 文档</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        h1 { color: #333; border-bottom: 2px solid #007acc; padding-bottom: 10px; }
        h2 { color: #555; margin-top: 30px; }
        .endpoint { background: #f8f9fa; padding: 15px; margin: 10px 0; border-radius: 5px; border-left: 4px solid #007acc; }
        .method { display: inline-block; padding: 2px 8px; border-radius: 3px; color: white; font-weight: bold; margin-right: 10px; }
        .get { background: #28a745; }
        .post { background: #007bff; }
        code { background: #e9ecef; padding: 2px 4px; border-radius: 3px; font-family: 'Courier New', monospace; }
        .params { margin-top: 10px; }
        .param { margin: 5px 0; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🎵 UNM-Server V2 API 文档</h1>
        <p>现代化音乐API服务，提供音乐搜索、播放链接获取、歌词和封面等功能。</p>

        <h2>🎼 音乐API</h2>

        <div class="endpoint">
            <span class="method get">GET</span><code>/api/music/url</code>
            <p>获取歌曲播放链接</p>
            <div class="params">
                <div class="param"><strong>id</strong> (必需): 歌曲ID</div>
                <div class="param"><strong>br</strong> (可选): 比特率 (128/192/320/740/999，默认999)</div>
                <div class="param"><strong>source</strong> (可选): 音乐源</div>
            </div>
        </div>

        <div class="endpoint">
            <span class="method get">GET</span><code>/api/music/search</code>
            <p>搜索歌曲</p>
            <div class="params">
                <div class="param"><strong>name</strong> (必需): 搜索关键词</div>
                <div class="param"><strong>count</strong> (可选): 返回数量 (默认20)</div>
                <div class="param"><strong>pages</strong> (可选): 页码 (默认1)</div>
                <div class="param"><strong>source</strong> (可选): 音乐源</div>
            </div>
        </div>

        <div class="endpoint">
            <span class="method get">GET</span><code>/api/music/pic</code>
            <p>获取歌曲封面</p>
            <div class="params">
                <div class="param"><strong>id</strong> (必需): 图片ID</div>
                <div class="param"><strong>size</strong> (可选): 尺寸 (300/500，默认300)</div>
                <div class="param"><strong>source</strong> (可选): 音乐源</div>
            </div>
        </div>

        <div class="endpoint">
            <span class="method get">GET</span><code>/api/music/lyric</code>
            <p>获取歌词</p>
            <div class="params">
                <div class="param"><strong>id</strong> (必需): 歌词ID</div>
                <div class="param"><strong>source</strong> (可选): 音乐源</div>
            </div>
        </div>

        <h2>🔓 UNM解锁API</h2>

        <div class="endpoint">
            <span class="method get">GET</span><code>/api/unm/test</code>
            <p>测试UNM功能</p>
        </div>

        <div class="endpoint">
            <span class="method get">GET</span><code>/api/unm/match</code>
            <p>匹配歌曲</p>
            <div class="params">
                <div class="param"><strong>id</strong> (必需): 歌曲ID</div>
                <div class="param"><strong>server</strong> (可选): 音源列表 (逗号分隔)</div>
            </div>
        </div>

        <h2>📊 系统API</h2>

        <div class="endpoint">
            <span class="method get">GET</span><code>/health</code>
            <p>健康检查</p>
        </div>

        <div class="endpoint">
            <span class="method get">GET</span><code>/api/info</code>
            <p>获取API详细信息</p>
        </div>

        <h2>📝 响应格式</h2>
        <p>所有API响应都采用统一的JSON格式：</p>
        <pre><code>{
  "code": 200,
  "message": "请求成功",
  "data": { ... },
  "timestamp": 1703123456789
}</code></pre>
    </div>
</body>
</html>`;

  return c.html(html);
});
