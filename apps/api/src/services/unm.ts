import type { SongUrl, MusicSource } from '../../../../packages/shared/dist/index.js';
import { loadAllConfigs } from '../../../../packages/config/dist/index.js';
import { CacheManager, generateCacheKey } from '../../../../packages/shared/dist/index.js';

const configs = loadAllConfigs();

/**
 * 音乐源提供商接口
 */
interface MusicProvider {
  name: MusicSource;
  search(keyword: string): Promise<any[]>;
  getUrl(id: string, br?: number): Promise<SongUrl | null>;
  getLyric?(id: string): Promise<string | null>;
  getPic?(id: string, size?: number): Promise<string | null>;
}

/**
 * 网易云音乐提供商
 */
class NeteaseProvider implements MusicProvider {
  name: MusicSource = 'netease';
  private baseUrl = 'https://music.163.com/api';

  async search(keyword: string): Promise<any[]> {
    try {
      const response = await fetch(`${this.baseUrl}/search/get/web?csrf_token=hlpretag&hlposttag&s=${encodeURIComponent(keyword)}&type=1&offset=0&total=true&limit=30`);
      const data = await response.json();
      return data.result?.songs || [];
    } catch (error) {
      console.error('Netease search error:', error);
      return [];
    }
  }

  async getUrl(id: string, br: number = 320): Promise<SongUrl | null> {
    try {
      const response = await fetch(`${this.baseUrl}/song/enhance/player/url?id=${id}&ids=[${id}]&br=${br * 1000}&csrf_token=`);
      const data = await response.json();

      if (data.data && data.data[0] && data.data[0].url) {
        return {
          id,
          url: data.data[0].url,
          br: data.data[0].br / 1000,
          size: data.data[0].size,
          type: data.data[0].type,
          source: this.name,
        };
      }
      return null;
    } catch (error) {
      console.error('Netease getUrl error:', error);
      return null;
    }
  }

  async getLyric(id: string): Promise<string | null> {
    try {
      const response = await fetch(`${this.baseUrl}/song/lyric?id=${id}&lv=-1&kv=-1&tv=-1`);
      const data = await response.json();
      return data.lrc?.lyric || null;
    } catch (error) {
      console.error('Netease getLyric error:', error);
      return null;
    }
  }

  async getPic(id: string, size: number = 300): Promise<string | null> {
    try {
      const response = await fetch(`${this.baseUrl}/song/detail?ids=[${id}]`);
      const data = await response.json();
      const song = data.songs?.[0];
      if (song?.al?.picUrl) {
        return `${song.al.picUrl}?param=${size}y${size}`;
      }
      return null;
    } catch (error) {
      console.error('Netease getPic error:', error);
      return null;
    }
  }
}

/**
 * QQ音乐提供商
 */
class TencentProvider implements MusicProvider {
  name: MusicSource = 'tencent';
  private baseUrl = 'https://c.y.qq.com';

  async search(keyword: string): Promise<any[]> {
    try {
      const response = await fetch(`${this.baseUrl}/soso/fcgi-bin/client_search_cp?ct=24&qqmusic_ver=1298&new_json=1&remoteplace=txt.yqq.song&searchid=&t=0&aggr=1&cr=1&catZhida=1&lossless=0&flag_qc=0&p=1&n=30&w=${encodeURIComponent(keyword)}&g_tk=&loginUin=&hostUin=0&format=json&inCharset=utf8&outCharset=utf-8&notice=0&platform=yqq.json&needNewCode=0`);
      const data = await response.json();
      return data.data?.song?.list || [];
    } catch (error) {
      console.error('Tencent search error:', error);
      return [];
    }
  }

  async getUrl(id: string, br: number = 320): Promise<SongUrl | null> {
    try {
      // QQ音乐需要特殊的URL获取逻辑
      const response = await fetch(`${this.baseUrl}/v8/fcg-bin/fcg_play_single_song.fcg?songmid=${id}&tpl=yqq_song_detail&format=json&g_tk=&loginUin=&hostUin=0&inCharset=utf8&outCharset=utf-8&notice=0&platform=yqq.json&needNewCode=0`);
      const data = await response.json();

      if (data.data && data.data[0]) {
        const song = data.data[0];
        return {
          id,
          url: `https://dl.stream.qqmusic.qq.com/${song.filename}?guid=&vkey=${song.vkey}&uin=&fromtag=`,
          br,
          size: song.size,
          type: 'mp3',
          source: this.name,
        };
      }
      return null;
    } catch (error) {
      console.error('Tencent getUrl error:', error);
      return null;
    }
  }
}

class UnmService {
  private providers: Map<MusicSource, MusicProvider> = new Map();

  constructor() {
    // 初始化音乐提供商
    this.providers.set('netease', new NeteaseProvider());
    this.providers.set('tencent', new TencentProvider());
  }

  /**
   * 测试UNM功能
   */
  async test(): Promise<any> {
    try {
      const testSongId = configs.unm.testSongId;
      const availableSources: string[] = [];

      // 测试每个音源的可用性
      for (const [sourceName, provider] of this.providers) {
        try {
          const testResult = await provider.getUrl(testSongId);
          if (testResult) {
            availableSources.push(sourceName);
          }
        } catch (error) {
          console.warn(`Source ${sourceName} test failed:`, error);
        }
      }

      return {
        songId: testSongId,
        sources: configs.unm.defaultSources,
        status: availableSources.length > 0 ? 'success' : 'partial',
        message: `UNM功能正常，${availableSources.length}个音源可用`,
        timestamp: new Date().toISOString(),
        availableSources,
        totalSources: this.providers.size,
      };
    } catch (error) {
      console.error('UNM test error:', error);
      throw new Error('UNM测试失败');
    }
  }

  /**
   * 歌曲匹配 (带缓存)
   */
  async match(id: string, server?: string): Promise<SongUrl | null> {
    try {
      // 生成缓存键
      const cacheKey = generateCacheKey('unm:match', id, server || 'default');

      // 尝试从缓存获取
      const cacheManager = CacheManager.getInstance();
      if (cacheManager.isReady()) {
        const cache = cacheManager.getCache();
        const cachedResult = await cache.get<SongUrl>(cacheKey);
        if (cachedResult) {
          return cachedResult;
        }
      }

      // 解析服务器列表
      const requestedSources = server ? server.split(',').map(s => s.trim()) : configs.unm.defaultSources;

      // 按优先级尝试每个音源
      for (const sourceName of requestedSources) {
        const provider = this.providers.get(sourceName as MusicSource);
        if (!provider) {
          console.warn(`Unknown music source: ${sourceName}`);
          continue;
        }

        try {
          console.log(`尝试从 ${sourceName} 获取歌曲 ${id}`);
          const result = await provider.getUrl(id);

          if (result && result.url) {
            // 添加代理URL如果配置了
            if (configs.app.proxyUrl) {
              result.proxyUrl = configs.app.proxyUrl;
            }

            // 缓存成功的结果
            if (cacheManager.isReady()) {
              const cache = cacheManager.getCache();
              await cache.set(cacheKey, result, 3600); // 缓存1小时
            }

            console.log(`成功从 ${sourceName} 获取歌曲 ${id}`);
            return result;
          }
        } catch (sourceError) {
          console.warn(`Source ${sourceName} failed for song ${id}:`, sourceError);
          continue;
        }
      }

      console.log(`所有音源都无法获取歌曲 ${id}`);

      return null;
    } catch (error) {
      console.error('UNM match error:', error);
      return null;
    }
  }

  /**
   * 搜索歌曲
   */
  async search(keyword: string, source?: MusicSource): Promise<any[]> {
    try {
      const cacheKey = generateCacheKey('unm:search', keyword, source || 'all');

      // 尝试从缓存获取
      const cacheManager = CacheManager.getInstance();
      if (cacheManager.isReady()) {
        const cache = cacheManager.getCache();
        const cachedResult = await cache.get<any[]>(cacheKey);
        if (cachedResult) {
          return cachedResult;
        }
      }

      let results: any[] = [];

      if (source) {
        // 搜索指定音源
        const provider = this.providers.get(source);
        if (provider) {
          results = await provider.search(keyword);
        }
      } else {
        // 搜索所有音源并合并结果
        const searchPromises = Array.from(this.providers.values()).map(async (provider) => {
          try {
            const providerResults = await provider.search(keyword);
            return providerResults.map(song => ({ ...song, source: provider.name }));
          } catch (error) {
            console.warn(`Search failed for ${provider.name}:`, error);
            return [];
          }
        });

        const allResults = await Promise.all(searchPromises);
        results = allResults.flat();
      }

      // 缓存搜索结果
      if (cacheManager.isReady()) {
        const cache = cacheManager.getCache();
        await cache.set(cacheKey, results, 1800); // 缓存30分钟
      }

      return results;
    } catch (error) {
      console.error('UNM search error:', error);
      return [];
    }
  }

  /**
   * 获取歌词
   */
  async getLyric(id: string, source: MusicSource): Promise<string | null> {
    try {
      const cacheKey = generateCacheKey('unm:lyric', id, source);

      // 尝试从缓存获取
      const cacheManager = CacheManager.getInstance();
      if (cacheManager.isReady()) {
        const cache = cacheManager.getCache();
        const cachedResult = await cache.get<string>(cacheKey);
        if (cachedResult) {
          return cachedResult;
        }
      }

      const provider = this.providers.get(source);
      if (!provider || !provider.getLyric) {
        return null;
      }

      const lyric = await provider.getLyric(id);

      // 缓存歌词
      if (lyric && cacheManager.isReady()) {
        const cache = cacheManager.getCache();
        await cache.set(cacheKey, lyric, 7200); // 缓存2小时
      }

      return lyric;
    } catch (error) {
      console.error('UNM getLyric error:', error);
      return null;
    }
  }

  /**
   * 获取封面图片
   */
  async getPic(id: string, source: MusicSource, size?: number): Promise<string | null> {
    try {
      const cacheKey = generateCacheKey('unm:pic', id, source, size?.toString() || '300');

      // 尝试从缓存获取
      const cacheManager = CacheManager.getInstance();
      if (cacheManager.isReady()) {
        const cache = cacheManager.getCache();
        const cachedResult = await cache.get<string>(cacheKey);
        if (cachedResult) {
          return cachedResult;
        }
      }

      const provider = this.providers.get(source);
      if (!provider || !provider.getPic) {
        return null;
      }

      const picUrl = await provider.getPic(id, size);

      // 缓存图片URL
      if (picUrl && cacheManager.isReady()) {
        const cache = cacheManager.getCache();
        await cache.set(cacheKey, picUrl, 7200); // 缓存2小时
      }

      return picUrl;
    } catch (error) {
      console.error('UNM getPic error:', error);
      return null;
    }
  }

  /**
   * 获取可用音源列表
   */
  getAvailableSources(): MusicSource[] {
    return Array.from(this.providers.keys());
  }

  /**
   * 检查音源状态
   */
  async checkSourceStatus(source: MusicSource): Promise<boolean> {
    try {
      const provider = this.providers.get(source);
      if (!provider) {
        return false;
      }

      // 尝试搜索一个测试关键词来检查音源状态
      const testResults = await provider.search('test');
      return Array.isArray(testResults);
    } catch (error) {
      console.error(`Check source ${source} status error:`, error);
      return false;
    }
  }

  /**
   * 获取所有音源的状态
   */
  async getAllSourcesStatus(): Promise<Record<MusicSource, boolean>> {
    const statusPromises = Array.from(this.providers.keys()).map(async (source) => {
      const status = await this.checkSourceStatus(source);
      return [source, status] as [MusicSource, boolean];
    });

    const statuses = await Promise.all(statusPromises);
    return Object.fromEntries(statuses) as Record<MusicSource, boolean>;
  }
}

export const unmService = new UnmService();
