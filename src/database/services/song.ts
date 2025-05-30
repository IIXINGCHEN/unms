import type { Song, SongUrl, MusicSource, Prisma } from '../../generated/client/index.js';
import { BaseService } from './base.js';

/**
 * 歌曲创建数据
 */
export interface CreateSongData {
  title: string;
  artist: string;
  album?: string;
  duration?: number;
  coverUrl?: string;
  lyricUrl?: string;
  source: MusicSource;
  sourceId: string;
  quality?: string;
  fileSize?: bigint;
  format?: string;
  bitrate?: number;
}

/**
 * 歌曲URL创建数据
 */
export interface CreateSongUrlData {
  songId: string;
  url: string;
  quality: string;
  bitrate?: number;
  format: string;
  fileSize?: bigint;
  expiresAt?: Date;
}

/**
 * 歌曲查询过滤器
 */
export interface SongFilters {
  title?: string;
  artist?: string;
  album?: string;
  source?: MusicSource;
  isAvailable?: boolean;
  searchTitle?: string;
  searchArtist?: string;
  searchAlbum?: string;
  duration?: {
    from?: number;
    to?: number;
  };
  createdAt?: {
    from?: Date;
    to?: Date;
  };
}

/**
 * 歌曲服务类
 */
export class SongService extends BaseService {
  /**
   * 创建歌曲
   */
  async createSong(data: CreateSongData): Promise<Song> {
    try {
      // 验证必需字段
      this.validateRequired(data, ['title', 'artist', 'source', 'sourceId']);

      // 清理数据
      const cleanedData = this.cleanData(data);

      // 检查是否已存在相同的歌曲
      const existingSong = await this.db.song.findUnique({
        where: {
          source_sourceId: {
            source: cleanedData.source,
            sourceId: cleanedData.sourceId,
          },
        },
      });

      if (existingSong) {
        throw new Error('歌曲已存在');
      }

      // 创建歌曲
      const song = await this.db.song.create({
        data: cleanedData as any,
      });

      return song;
    } catch (error) {
      this.handleDatabaseError(error, '创建歌曲');
    }
  }

  /**
   * 根据ID获取歌曲
   */
  async getSongById(id: string, includeUrls: boolean = false): Promise<Song | null> {
    try {
      this.validateId(id, '歌曲ID');

      const song = await this.db.song.findUnique({
        where: { id },
        include: {
          songUrls: includeUrls ? {
            where: { isActive: true },
            orderBy: { createdAt: 'desc' },
          } : false,
          _count: {
            select: {
              favorites: true,
              playlistSongs: true,
            },
          },
        },
      });

      return song;
    } catch (error) {
      this.handleDatabaseError(error, '获取歌曲');
    }
  }

  /**
   * 根据来源和来源ID获取歌曲
   */
  async getSongBySourceId(source: MusicSource, sourceId: string): Promise<Song | null> {
    try {
      if (!sourceId) throw new Error('来源ID不能为空');

      const song = await this.db.song.findUnique({
        where: {
          source_sourceId: {
            source,
            sourceId,
          },
        },
        include: {
          songUrls: {
            where: { isActive: true },
            orderBy: { createdAt: 'desc' },
          },
        },
      });

      return song;
    } catch (error) {
      this.handleDatabaseError(error, '根据来源ID获取歌曲');
    }
  }

  /**
   * 更新歌曲
   */
  async updateSong(id: string, data: Partial<CreateSongData>): Promise<Song> {
    try {
      this.validateId(id, '歌曲ID');

      // 检查歌曲是否存在
      await this.checkExists(this.db.song, { id }, '歌曲不存在');

      // 清理数据
      const cleanedData = this.cleanData(data);

      // 更新歌曲
      const song = await this.db.song.update({
        where: { id },
        data: cleanedData,
      });

      return song;
    } catch (error) {
      this.handleDatabaseError(error, '更新歌曲');
    }
  }

  /**
   * 删除歌曲
   */
  async deleteSong(id: string): Promise<void> {
    try {
      this.validateId(id, '歌曲ID');

      // 检查歌曲是否存在
      await this.checkExists(this.db.song, { id }, '歌曲不存在');

      // 在事务中删除歌曲及相关数据
      await this.executeInTransaction(async (tx) => {
        // 删除歌曲URL
        await tx.songUrl.deleteMany({
          where: { songId: id },
        });

        // 删除收藏记录
        await tx.favorite.deleteMany({
          where: { songId: id },
        });

        // 删除播放列表中的歌曲
        await tx.playlistSong.deleteMany({
          where: { songId: id },
        });

        // 删除歌曲
        await tx.song.delete({
          where: { id },
        });
      });
    } catch (error) {
      this.handleDatabaseError(error, '删除歌曲');
    }
  }

  /**
   * 搜索歌曲
   */
  async searchSongs(
    keyword: string,
    filters: SongFilters = {},
    page?: number,
    limit?: number,
    sortBy?: string,
    sortOrder?: 'asc' | 'desc'
  ) {
    try {
      if (!keyword || keyword.trim().length === 0) {
        throw new Error('搜索关键词不能为空');
      }

      const { skip, take, page: pageNum, limit: limitNum } = this.getPaginationParams(page, limit);

      // 构建搜索条件
      const searchConditions = {
        OR: [
          { title: { contains: keyword, mode: 'insensitive' as const } },
          { artist: { contains: keyword, mode: 'insensitive' as const } },
          { album: { contains: keyword, mode: 'insensitive' as const } },
        ],
      };

      // 合并其他过滤条件
      const where = {
        ...searchConditions,
        ...this.buildWhereClause(filters),
      };

      const orderBy = this.buildOrderBy(sortBy, sortOrder) || { createdAt: 'desc' };

      const [songs, total] = await Promise.all([
        this.db.song.findMany({
          where,
          skip,
          take,
          orderBy,
          include: {
            _count: {
              select: {
                favorites: true,
                playlistSongs: true,
              },
            },
          },
        }),
        this.db.song.count({ where }),
      ]);

      return this.buildPaginatedResponse(songs, total, pageNum, limitNum);
    } catch (error) {
      this.handleDatabaseError(error, '搜索歌曲');
    }
  }

  /**
   * 获取歌曲列表
   */
  async getSongs(
    filters: SongFilters = {},
    page?: number,
    limit?: number,
    sortBy?: string,
    sortOrder?: 'asc' | 'desc'
  ) {
    try {
      const { skip, take, page: pageNum, limit: limitNum } = this.getPaginationParams(page, limit);
      const where = this.buildWhereClause(filters);
      const orderBy = this.buildOrderBy(sortBy, sortOrder) || { createdAt: 'desc' };

      const [songs, total] = await Promise.all([
        this.db.song.findMany({
          where,
          skip,
          take,
          orderBy,
          include: {
            _count: {
              select: {
                favorites: true,
                playlistSongs: true,
              },
            },
          },
        }),
        this.db.song.count({ where }),
      ]);

      return this.buildPaginatedResponse(songs, total, pageNum, limitNum);
    } catch (error) {
      this.handleDatabaseError(error, '获取歌曲列表');
    }
  }

  /**
   * 添加歌曲URL
   */
  async addSongUrl(data: CreateSongUrlData): Promise<SongUrl> {
    try {
      // 验证必需字段
      this.validateRequired(data, ['songId', 'url', 'quality', 'format']);

      // 检查歌曲是否存在
      await this.checkExists(this.db.song, { id: data.songId }, '歌曲不存在');

      // 清理数据
      const cleanedData = this.cleanData(data);

      // 创建歌曲URL
      const songUrl = await this.db.songUrl.create({
        data: cleanedData as any,
      });

      return songUrl;
    } catch (error) {
      this.handleDatabaseError(error, '添加歌曲URL');
    }
  }

  /**
   * 获取歌曲的有效URL
   */
  async getSongUrls(songId: string): Promise<SongUrl[]> {
    try {
      this.validateId(songId, '歌曲ID');

      const urls = await this.db.songUrl.findMany({
        where: {
          songId,
          isActive: true,
          OR: [
            { expiresAt: null },
            { expiresAt: { gt: new Date() } },
          ],
        },
        orderBy: [
          { bitrate: 'desc' },
          { createdAt: 'desc' },
        ],
      });

      return urls;
    } catch (error) {
      this.handleDatabaseError(error, '获取歌曲URL');
    }
  }

  /**
   * 更新歌曲可用性
   */
  async updateSongAvailability(id: string, isAvailable: boolean): Promise<Song> {
    try {
      this.validateId(id, '歌曲ID');

      const song = await this.db.song.update({
        where: { id },
        data: { isAvailable },
      });

      return song;
    } catch (error) {
      this.handleDatabaseError(error, '更新歌曲可用性');
    }
  }

  /**
   * 获取热门歌曲
   */
  async getPopularSongs(limit: number = 50): Promise<Song[]> {
    try {
      const songs = await this.db.song.findMany({
        where: { isAvailable: true },
        include: {
          _count: {
            select: {
              favorites: true,
              playlistSongs: true,
            },
          },
        },
        orderBy: [
          { favorites: { _count: 'desc' } },
          { playlistSongs: { _count: 'desc' } },
          { createdAt: 'desc' },
        ],
        take: limit,
      });

      return songs;
    } catch (error) {
      this.handleDatabaseError(error, '获取热门歌曲');
    }
  }

  /**
   * 获取歌曲统计信息
   */
  async getSongStats(): Promise<{
    total: number;
    available: number;
    unavailable: number;
    bySource: Record<MusicSource, number>;
    recentlyAdded: number;
  }> {
    try {
      const [total, available, unavailable, bySource, recentlyAdded] = await Promise.all([
        this.db.song.count(),
        this.db.song.count({ where: { isAvailable: true } }),
        this.db.song.count({ where: { isAvailable: false } }),
        this.db.song.groupBy({
          by: ['source'],
          _count: { source: true },
        }),
        this.db.song.count({
          where: {
            createdAt: {
              gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 最近7天
            },
          },
        }),
      ]);

      const sourceStats = bySource.reduce((acc, item) => {
        acc[item.source] = item._count.source;
        return acc;
      }, {} as Record<MusicSource, number>);

      return {
        total,
        available,
        unavailable,
        bySource: sourceStats,
        recentlyAdded,
      };
    } catch (error) {
      this.handleDatabaseError(error, '获取歌曲统计信息');
    }
  }
}
