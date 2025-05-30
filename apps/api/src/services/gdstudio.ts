import type { SongUrl, SearchResult, PicInfo, Lyric, MusicSource } from '../../../../packages/shared/dist/index.js';
import { loadAllConfigs } from '../../../../packages/config/dist/index.js';

const configs = loadAllConfigs();

class GdStudioService {
  private baseUrl: string;
  private timeout: number;

  constructor() {
    this.baseUrl = configs.gdstudio.baseUrl;
    this.timeout = configs.gdstudio.requestTimeout;
  }

  /**
   * 发送请求到GDStudio API
   */
  private async request(params: Record<string, string>): Promise<any> {
    const url = new URL(this.baseUrl);
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.append(key, value);
    });

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url.toString(), {
        method: 'GET',
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json, text/plain, */*',
          'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
          'Accept-Encoding': 'gzip, deflate, br',
          'Connection': 'keep-alive',
          'Referer': 'https://music.163.com/',
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('请求超时');
      }
      throw error;
    }
  }

  /**
   * 获取歌曲播放链接
   */
  async getUrl(id: string, br: string = '999', source?: MusicSource): Promise<SongUrl | null> {
    try {
      const params: Record<string, string> = {
        types: 'url',
        id,
        br,
      };

      if (source) {
        params.source = source;
      }

      const data = await this.request(params);

      if (data && data.url) {
        return {
          id,
          url: data.url,
          br: parseInt(br),
          size: data.size,
          type: data.type,
          md5: data.md5,
          source: source || configs.gdstudio.defaultSource,
        };
      }

      return null;
    } catch (error) {
      console.error('GDStudio getUrl error:', error);
      return null;
    }
  }

  /**
   * 搜索歌曲
   */
  async search(name: string, count: number = 20, pages: number = 1, source?: MusicSource): Promise<SearchResult> {
    try {
      const params: Record<string, string> = {
        types: 'search',
        name,
        count: count.toString(),
        pages: pages.toString(),
      };

      if (source) {
        params.source = source;
      }

      const data = await this.request(params);

      if (data && Array.isArray(data)) {
        return data.map((item: any) => ({
          id: item.id || '',
          name: item.name || '',
          artist: item.artist || '',
          album: item.album || '',
          duration: item.duration,
          pic_id: item.pic_id,
          lyric_id: item.lyric_id,
          source: source || configs.gdstudio.defaultSource,
        }));
      }

      return [];
    } catch (error) {
      console.error('GDStudio search error:', error);
      return [];
    }
  }

  /**
   * 获取封面图片
   */
  async getPic(id: string, size: string = '300', source?: MusicSource): Promise<PicInfo | null> {
    try {
      const params: Record<string, string> = {
        types: 'pic',
        id,
        size,
      };

      if (source) {
        params.source = source;
      }

      const data = await this.request(params);

      if (data && data.url) {
        return {
          url: data.url,
          source: source || configs.gdstudio.defaultSource,
        };
      }

      return null;
    } catch (error) {
      console.error('GDStudio getPic error:', error);
      return null;
    }
  }

  /**
   * 获取歌词
   */
  async getLyric(id: string, source?: MusicSource): Promise<Lyric | null> {
    try {
      const params: Record<string, string> = {
        types: 'lyric',
        id,
      };

      if (source) {
        params.source = source;
      }

      const data = await this.request(params);

      if (data && data.lyric) {
        return {
          lyric: data.lyric,
          tlyric: data.tlyric,
          source: source || configs.gdstudio.defaultSource,
        };
      }

      return null;
    } catch (error) {
      console.error('GDStudio getLyric error:', error);
      return null;
    }
  }
}

export const gdStudioService = new GdStudioService();
