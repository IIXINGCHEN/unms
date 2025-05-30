import { PrismaClient } from '../generated/client/index.js';
import type { LogLevel } from '../shared/index.js';

/**
 * 数据库配置接口
 */
export interface DatabaseConfig {
  url: string;
  maxConnections?: number;
  connectionTimeout?: number;
  queryTimeout?: number;
  logLevel?: LogLevel;
  enableLogging?: boolean;
  enableMetrics?: boolean;
}

/**
 * 数据库连接管理器
 */
export class DatabaseManager {
  private static instance: DatabaseManager;
  private client: PrismaClient | null = null;
  private config: DatabaseConfig;
  private isConnected = false;
  private connectionAttempts = 0;
  private maxConnectionAttempts = 5;
  private reconnectDelay = 1000;

  private constructor(config: DatabaseConfig) {
    this.config = config;
  }

  /**
   * 获取数据库管理器实例
   */
  static getInstance(config?: DatabaseConfig): DatabaseManager {
    if (!DatabaseManager.instance) {
      if (!config) {
        throw new Error('数据库配置是必需的');
      }
      DatabaseManager.instance = new DatabaseManager(config);
    }
    return DatabaseManager.instance;
  }

  /**
   * 初始化数据库连接
   */
  async initialize(): Promise<void> {
    try {
      this.client = new PrismaClient({
        datasources: {
          db: {
            url: this.config.url,
          },
        },
        log: this.config.enableLogging ? ['query', 'error', 'info', 'warn'] : [],
      });

      // 测试连接
      await this.testConnection();

      this.isConnected = true;
      this.connectionAttempts = 0;

      console.log('✅ 数据库连接已建立');
    } catch (error) {
      console.error('❌ 数据库连接失败:', error);
      this.handleConnectionError(error);
    }
  }



  /**
   * 测试数据库连接
   */
  private async testConnection(): Promise<void> {
    if (!this.client) {
      throw new Error('数据库客户端未初始化');
    }

    try {
      await this.client.$queryRaw`SELECT 1`;
    } catch (error) {
      throw new Error(`数据库连接测试失败: ${error}`);
    }
  }

  /**
   * 处理连接错误
   */
  private handleConnectionError(error: any): void {
    this.isConnected = false;
    this.connectionAttempts++;

    if (this.connectionAttempts < this.maxConnectionAttempts) {
      const delay = this.reconnectDelay * Math.pow(2, this.connectionAttempts - 1);
      console.log(`🔄 ${delay}ms后尝试第${this.connectionAttempts}次重连...`);

      setTimeout(() => {
        this.initialize();
      }, delay);
    } else {
      console.error('❌ 数据库连接重试次数超过限制');
      throw error;
    }
  }

  /**
   * 获取Prisma客户端
   */
  getClient(): PrismaClient {
    if (!this.client) {
      throw new Error('数据库客户端未初始化，请先调用initialize()');
    }
    return this.client;
  }

  /**
   * 检查连接状态
   */
  isHealthy(): boolean {
    return this.isConnected && this.client !== null;
  }

  /**
   * 获取连接统计信息
   */
  async getStats(): Promise<{
    isConnected: boolean;
    connectionAttempts: number;
    databaseVersion?: string;
    activeConnections?: number;
  }> {
    const stats = {
      isConnected: this.isConnected,
      connectionAttempts: this.connectionAttempts,
    };

    if (this.client && this.isConnected) {
      try {
        // 获取数据库版本
        const versionResult = await this.client.$queryRaw<Array<{ version: string }>>`SELECT version()`;
        if (versionResult.length > 0 && versionResult[0]) {
          (stats as any).databaseVersion = versionResult[0].version;
        }

        // 获取活跃连接数
        const connectionResult = await this.client.$queryRaw<Array<{ count: bigint }>>`
          SELECT count(*) as count FROM pg_stat_activity WHERE state = 'active'
        `;
        if (connectionResult.length > 0 && connectionResult[0]) {
          (stats as any).activeConnections = Number(connectionResult[0].count);
        }
      } catch (error) {
        console.warn('获取数据库统计信息失败:', error);
      }
    }

    return stats;
  }

  /**
   * 执行事务
   */
  async transaction<T>(
    fn: (client: any) => Promise<T>,
    options?: {
      timeout?: number;
      isolationLevel?: 'ReadUncommitted' | 'ReadCommitted' | 'RepeatableRead' | 'Serializable';
    }
  ): Promise<T> {
    if (!this.client) {
      throw new Error('数据库客户端未初始化');
    }

    const transactionOptions: any = {
      timeout: options?.timeout || this.config.queryTimeout || 10000,
    };

    if (options?.isolationLevel) {
      transactionOptions.isolationLevel = options.isolationLevel;
    }

    return await this.client.$transaction(fn as any, transactionOptions) as T;
  }

  /**
   * 执行原始查询
   */
  async queryRaw<T = unknown>(query: string, ...values: any[]): Promise<T> {
    if (!this.client) {
      throw new Error('数据库客户端未初始化');
    }

    return await this.client.$queryRawUnsafe<T>(query, ...values);
  }

  /**
   * 执行原始命令
   */
  async executeRaw(query: string, ...values: any[]): Promise<number> {
    if (!this.client) {
      throw new Error('数据库客户端未初始化');
    }

    return await this.client.$executeRawUnsafe(query, ...values);
  }

  /**
   * 关闭数据库连接
   */
  async close(): Promise<void> {
    if (this.client) {
      await this.client.$disconnect();
      this.client = null;
      this.isConnected = false;
      console.log('✅ 数据库连接已关闭');
    }
  }

  /**
   * 重置连接
   */
  async reset(): Promise<void> {
    await this.close();
    this.connectionAttempts = 0;
    await this.initialize();
  }
}

/**
 * 获取数据库客户端的便捷函数
 */
export function getDatabase(): PrismaClient {
  return DatabaseManager.getInstance().getClient();
}

/**
 * 数据库健康检查
 */
export async function checkDatabaseHealth(): Promise<{
  status: 'healthy' | 'unhealthy';
  details: any;
}> {
  try {
    const manager = DatabaseManager.getInstance();
    const stats = await manager.getStats();

    return {
      status: manager.isHealthy() ? 'healthy' : 'unhealthy',
      details: stats,
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      details: { error: error instanceof Error ? error.message : String(error) },
    };
  }
}

/**
 * 数据库迁移工具
 */
export class DatabaseMigration {
  private client: PrismaClient;

  constructor(client: PrismaClient) {
    this.client = client;
  }

  /**
   * 检查数据库是否需要迁移
   */
  async needsMigration(): Promise<boolean> {
    try {
      // 检查_prisma_migrations表是否存在
      const result = await this.client.$queryRaw<Array<{ exists: boolean }>>`
        SELECT EXISTS (
          SELECT FROM information_schema.tables
          WHERE table_schema = 'public'
          AND table_name = '_prisma_migrations'
        ) as exists
      `;

      return !result[0]?.exists;
    } catch (error) {
      console.warn('检查迁移状态失败:', error);
      return true;
    }
  }

  /**
   * 获取迁移状态
   */
  async getMigrationStatus(): Promise<{
    applied: number;
    pending: number;
    failed: number;
  }> {
    try {
      const result = await this.client.$queryRaw<Array<{
        applied: bigint;
        pending: bigint;
        failed: bigint;
      }>>`
        SELECT
          COUNT(CASE WHEN finished_at IS NOT NULL THEN 1 END) as applied,
          COUNT(CASE WHEN finished_at IS NULL AND started_at IS NOT NULL THEN 1 END) as pending,
          COUNT(CASE WHEN rolled_back_at IS NOT NULL THEN 1 END) as failed
        FROM _prisma_migrations
      `;

      if (result.length > 0 && result[0]) {
        return {
          applied: Number(result[0].applied),
          pending: Number(result[0].pending),
          failed: Number(result[0].failed),
        };
      }
    } catch (error) {
      console.warn('获取迁移状态失败:', error);
    }

    return { applied: 0, pending: 0, failed: 0 };
  }
}
