// 导出Prisma客户端和类型
export * from '../generated/client/index.js';

// 导出数据库管理器
export {
  DatabaseManager,
  getDatabase,
  checkDatabaseHealth,
  DatabaseMigration,
  type DatabaseConfig,
} from './client.js';

// 导出基础服务
export { BaseService } from './services/base.js';

// 导出用户服务
export {
  UserService,
  type CreateUserData,
  type UpdateUserData,
  type UserFilters,
} from './services/user.js';

// 导出歌曲服务
export {
  SongService,
  type CreateSongData,
  type CreateSongUrlData,
  type SongFilters,
} from './services/song.js';

// 导出数据库初始化函数
export { initializeDatabase } from './init.js';

// 导出种子数据函数
export { seedDatabase } from './seed.js';
