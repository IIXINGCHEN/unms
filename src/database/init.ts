import { DatabaseManager, DatabaseMigration, type DatabaseConfig } from './client.js';
import { LogLevel } from '../shared/index.js';

/**
 * 初始化数据库
 */
export async function initializeDatabase(config: DatabaseConfig): Promise<{
  manager: DatabaseManager;
  migration: DatabaseMigration;
  isFirstTime: boolean;
}> {
  try {
    console.log('🔄 正在初始化数据库...');

    // 创建数据库管理器实例
    const manager = DatabaseManager.getInstance(config);

    // 初始化连接
    await manager.initialize();

    // 获取客户端
    const client = manager.getClient();

    // 创建迁移工具
    const migration = new DatabaseMigration(client);

    // 检查是否需要迁移
    const needsMigration = await migration.needsMigration();

    if (needsMigration) {
      console.log('📋 检测到数据库需要初始化');

      // 在生产环境中，我们不自动运行迁移
      if (process.env.NODE_ENV === 'production') {
        console.warn('⚠️  生产环境检测到未迁移的数据库，请手动运行迁移命令');
        console.warn('   运行: pnpm db:deploy');
      } else {
        console.log('🔄 开发环境自动运行数据库迁移...');
        // 在开发环境中可以考虑自动运行迁移，但这里我们只是提示
        console.log('   请运行: pnpm db:push 或 pnpm db:migrate');
      }
    } else {
      console.log('✅ 数据库已是最新状态');
    }

    // 获取迁移状态
    const migrationStatus = await migration.getMigrationStatus();
    console.log('📊 迁移状态:', migrationStatus);

    console.log('✅ 数据库初始化完成');

    return {
      manager,
      migration,
      isFirstTime: needsMigration,
    };
  } catch (error) {
    console.error('❌ 数据库初始化失败:', error);
    throw error;
  }
}

/**
 * 验证数据库配置
 */
export function validateDatabaseConfig(config: Partial<DatabaseConfig>): DatabaseConfig {
  if (!config.url) {
    throw new Error('数据库URL是必需的');
  }

  // 验证URL格式
  try {
    new URL(config.url);
  } catch (error) {
    throw new Error('无效的数据库URL格式');
  }

  // 设置默认值
  const validatedConfig: DatabaseConfig = {
    url: config.url,
    maxConnections: config.maxConnections || 10,
    connectionTimeout: config.connectionTimeout || 10000,
    queryTimeout: config.queryTimeout || 30000,
    logLevel: config.logLevel || LogLevel.INFO,
    enableLogging: config.enableLogging !== false,
    enableMetrics: config.enableMetrics !== false,
  };

  return validatedConfig;
}

/**
 * 创建数据库配置从环境变量
 */
export function createDatabaseConfigFromEnv(): DatabaseConfig {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error('DATABASE_URL 环境变量未设置');
  }

  const config: DatabaseConfig = {
    url: databaseUrl,
    maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS || '10'),
    connectionTimeout: parseInt(process.env.DB_CONNECTION_TIMEOUT || '10000'),
    queryTimeout: parseInt(process.env.DB_QUERY_TIMEOUT || '30000'),
    logLevel: (process.env.DB_LOG_LEVEL as any) || 'INFO',
    enableLogging: process.env.DB_ENABLE_LOGGING !== 'false',
    enableMetrics: process.env.DB_ENABLE_METRICS !== 'false',
  };

  return validateDatabaseConfig(config);
}

/**
 * 数据库健康检查和自动恢复
 */
export async function performDatabaseHealthCheck(): Promise<{
  isHealthy: boolean;
  details: any;
  actions: string[];
}> {
  const actions: string[] = [];

  try {
    const manager = DatabaseManager.getInstance();

    if (!manager.isHealthy()) {
      actions.push('尝试重新连接数据库');
      await manager.reset();
    }

    const stats = await manager.getStats();

    // 检查连接数是否过高
    if (stats.activeConnections && stats.activeConnections > 50) {
      actions.push('活跃连接数过高，建议检查连接池配置');
    }

    return {
      isHealthy: manager.isHealthy(),
      details: stats,
      actions,
    };
  } catch (error) {
    return {
      isHealthy: false,
      details: { error: error instanceof Error ? error.message : String(error) },
      actions: ['数据库连接失败，请检查配置和网络'],
    };
  }
}

/**
 * 优雅关闭数据库连接
 */
export async function gracefulShutdown(): Promise<void> {
  try {
    console.log('🔄 正在关闭数据库连接...');

    const manager = DatabaseManager.getInstance();
    await manager.close();

    console.log('✅ 数据库连接已关闭');
  } catch (error) {
    console.error('❌ 关闭数据库连接时出错:', error);
    throw error;
  }
}

/**
 * 数据库备份检查
 */
export async function checkBackupStatus(): Promise<{
  lastBackup?: Date;
  backupSize?: number | undefined;
  isHealthy: boolean;
  recommendations: string[];
}> {
  const recommendations: string[] = [];

  try {
    const manager = DatabaseManager.getInstance();
    const client = manager.getClient();

    // 检查数据库大小
    const sizeResult = await client.$queryRaw<Array<{ size: string }>>`
      SELECT pg_size_pretty(pg_database_size(current_database())) as size
    `;

    const dbSize = sizeResult[0]?.size;

    // 检查表数量和记录数
    const tableStats = await client.$queryRaw<Array<{
      table_name: string;
      row_count: bigint;
    }>>`
      SELECT
        schemaname||'.'||tablename as table_name,
        n_tup_ins - n_tup_del as row_count
      FROM pg_stat_user_tables
      ORDER BY n_tup_ins - n_tup_del DESC
    `;

    // 生成建议
    if (tableStats.length > 0) {
      const totalRows = tableStats.reduce((sum, table) => sum + Number(table.row_count), 0);

      if (totalRows > 100000) {
        recommendations.push('数据量较大，建议设置定期备份');
      }

      if (totalRows > 1000000) {
        recommendations.push('数据量很大，建议考虑数据分区或归档策略');
      }
    }

    recommendations.push('建议设置自动备份任务');
    recommendations.push('定期测试备份恢复流程');

    const backupSize = dbSize ? parseInt(dbSize.replace(/[^\d]/g, '')) : undefined;

    return {
      backupSize: backupSize && !isNaN(backupSize) ? backupSize : undefined,
      isHealthy: true,
      recommendations,
    };
  } catch (error) {
    return {
      isHealthy: false,
      recommendations: ['无法检查备份状态，请检查数据库连接'],
    };
  }
}
