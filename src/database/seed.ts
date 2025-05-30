import { PrismaClient } from '../generated/client/index.js';
import { UserService, SongService } from './index.js';

/**
 * 种子数据配置
 */
interface SeedConfig {
  createAdminUser?: boolean;
  createSampleSongs?: boolean;
  createSystemConfigs?: boolean;
  adminEmail?: string;
  adminPassword?: string;
}

/**
 * 默认系统配置
 */
const DEFAULT_SYSTEM_CONFIGS = [
  {
    key: 'site_name',
    value: 'UNM-Server V2',
    type: 'STRING' as const,
    description: '网站名称',
    isPublic: true,
  },
  {
    key: 'site_description',
    value: '统一音乐搜索接口服务',
    type: 'STRING' as const,
    description: '网站描述',
    isPublic: true,
  },
  {
    key: 'max_search_results',
    value: '100',
    type: 'NUMBER' as const,
    description: '最大搜索结果数量',
    isPublic: false,
  },
  {
    key: 'enable_user_registration',
    value: 'true',
    type: 'BOOLEAN' as const,
    description: '是否允许用户注册',
    isPublic: true,
  },
  {
    key: 'default_music_quality',
    value: '320',
    type: 'NUMBER' as const,
    description: '默认音乐质量（kbps）',
    isPublic: true,
  },
  {
    key: 'cache_duration',
    value: '3600',
    type: 'NUMBER' as const,
    description: '缓存持续时间（秒）',
    isPublic: false,
  },
  {
    key: 'rate_limit_per_minute',
    value: '60',
    type: 'NUMBER' as const,
    description: '每分钟请求限制',
    isPublic: false,
  },
  {
    key: 'supported_sources',
    value: JSON.stringify(['NETEASE', 'TENCENT', 'KUGOU', 'KUWO']),
    type: 'JSON' as const,
    description: '支持的音乐源',
    isPublic: true,
  },
];

/**
 * 示例歌曲数据
 */
const SAMPLE_SONGS = [
  {
    title: '青花瓷',
    artist: '周杰伦',
    album: '我很忙',
    duration: 237,
    source: 'NETEASE' as const,
    sourceId: '185639',
    quality: '320kbps',
    format: 'mp3',
    bitrate: 320,
  },
  {
    title: '稻香',
    artist: '周杰伦',
    album: '魔杰座',
    duration: 223,
    source: 'NETEASE' as const,
    sourceId: '185868',
    quality: '320kbps',
    format: 'mp3',
    bitrate: 320,
  },
  {
    title: '夜曲',
    artist: '周杰伦',
    album: '十一月的萧邦',
    duration: 237,
    source: 'NETEASE' as const,
    sourceId: '185707',
    quality: '320kbps',
    format: 'mp3',
    bitrate: 320,
  },
  {
    title: '告白气球',
    artist: '周杰伦',
    album: '周杰伦的床边故事',
    duration: 207,
    source: 'TENCENT' as const,
    sourceId: '004Z8Ihr0JIu5s',
    quality: '320kbps',
    format: 'mp3',
    bitrate: 320,
  },
  {
    title: '演员',
    artist: '薛之谦',
    album: '绅士',
    duration: 266,
    source: 'NETEASE' as const,
    sourceId: '418603077',
    quality: '320kbps',
    format: 'mp3',
    bitrate: 320,
  },
];

/**
 * 执行数据库种子
 */
export async function seedDatabase(
  client?: PrismaClient,
  config: SeedConfig = {}
): Promise<void> {
  const db = client || new PrismaClient();

  try {
    console.log('🌱 开始执行数据库种子...');

    // 默认配置
    const seedConfig: Required<SeedConfig> = {
      createAdminUser: config.createAdminUser !== false,
      createSampleSongs: config.createSampleSongs !== false,
      createSystemConfigs: config.createSystemConfigs !== false,
      adminEmail: config.adminEmail || 'admin@unm-server.com',
      adminPassword: config.adminPassword || 'admin123456',
    };

    // 创建系统配置
    if (seedConfig.createSystemConfigs) {
      await createSystemConfigs(db);
    }

    // 创建管理员用户
    if (seedConfig.createAdminUser) {
      await createAdminUser(db, seedConfig.adminEmail, seedConfig.adminPassword);
    }

    // 创建示例歌曲
    if (seedConfig.createSampleSongs) {
      await createSampleSongs(db);
    }

    console.log('✅ 数据库种子执行完成');
  } catch (error) {
    console.error('❌ 数据库种子执行失败:', error);
    throw error;
  } finally {
    if (!client) {
      await db.$disconnect();
    }
  }
}

/**
 * 创建系统配置
 */
async function createSystemConfigs(db: PrismaClient): Promise<void> {
  console.log('📋 创建系统配置...');

  for (const config of DEFAULT_SYSTEM_CONFIGS) {
    try {
      await db.systemConfig.upsert({
        where: { key: config.key },
        update: {
          value: config.value,
          type: config.type,
          description: config.description,
          isPublic: config.isPublic,
        },
        create: config,
      });
      console.log(`  ✓ 配置项: ${config.key}`);
    } catch (error) {
      console.warn(`  ⚠ 配置项 ${config.key} 创建失败:`, error);
    }
  }

  console.log('✅ 系统配置创建完成');
}

/**
 * 创建管理员用户
 */
async function createAdminUser(
  db: PrismaClient,
  email: string,
  password: string
): Promise<void> {
  console.log('👤 创建管理员用户...');

  try {
    const userService = new UserService(db);

    // 检查管理员是否已存在
    const existingAdmin = await userService.getUserByEmail(email);
    if (existingAdmin) {
      console.log('  ℹ 管理员用户已存在，跳过创建');
      return;
    }

    // 创建管理员用户
    const admin = await userService.createUser({
      email,
      username: 'admin',
      password,
      role: 'ADMIN',
    });

    console.log(`  ✓ 管理员用户创建成功: ${admin.email}`);
    console.log(`  📧 邮箱: ${email}`);
    console.log(`  🔑 密码: ${password}`);
    console.log('  ⚠️  请在生产环境中修改默认密码！');
  } catch (error) {
    console.error('  ❌ 管理员用户创建失败:', error);
  }

  console.log('✅ 管理员用户处理完成');
}

/**
 * 创建示例歌曲
 */
async function createSampleSongs(db: PrismaClient): Promise<void> {
  console.log('🎵 创建示例歌曲...');

  try {
    const songService = new SongService(db);

    for (const songData of SAMPLE_SONGS) {
      try {
        // 检查歌曲是否已存在
        const existingSong = await songService.getSongBySourceId(
          songData.source,
          songData.sourceId
        );

        if (existingSong) {
          console.log(`  ℹ 歌曲已存在: ${songData.title} - ${songData.artist}`);
          continue;
        }

        // 创建歌曲
        const song = await songService.createSong(songData);
        console.log(`  ✓ 歌曲创建成功: ${song.title} - ${song.artist}`);
      } catch (error) {
        console.warn(`  ⚠ 歌曲创建失败: ${songData.title} - ${songData.artist}`, error);
      }
    }
  } catch (error) {
    console.error('  ❌ 示例歌曲创建失败:', error);
  }

  console.log('✅ 示例歌曲处理完成');
}

/**
 * 清理数据库（开发环境使用）
 */
export async function cleanDatabase(client?: PrismaClient): Promise<void> {
  const db = client || new PrismaClient();

  try {
    console.log('🧹 开始清理数据库...');

    // 按依赖关系顺序删除数据
    await db.userSession.deleteMany();
    await db.apiUsage.deleteMany();
    await db.searchLog.deleteMany();
    await db.errorLog.deleteMany();
    await db.cacheEntry.deleteMany();
    await db.playlistSong.deleteMany();
    await db.favorite.deleteMany();
    await db.songUrl.deleteMany();
    await db.playlist.deleteMany();
    await db.song.deleteMany();
    await db.user.deleteMany();
    await db.systemConfig.deleteMany();

    console.log('✅ 数据库清理完成');
  } catch (error) {
    console.error('❌ 数据库清理失败:', error);
    throw error;
  } finally {
    if (!client) {
      await db.$disconnect();
    }
  }
}

/**
 * 重置数据库（清理 + 种子）
 */
export async function resetDatabase(
  client?: PrismaClient,
  config: SeedConfig = {}
): Promise<void> {
  console.log('🔄 重置数据库...');

  await cleanDatabase(client);
  await seedDatabase(client, config);

  console.log('✅ 数据库重置完成');
}

// 如果直接运行此文件，执行种子
if (import.meta.url === `file://${process.argv[1]}`) {
  seedDatabase()
    .then(() => {
      console.log('种子执行完成');
      process.exit(0);
    })
    .catch((error) => {
      console.error('种子执行失败:', error);
      process.exit(1);
    });
}
