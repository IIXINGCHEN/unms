import { CacheManager, logger } from '@unm/shared';

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  version: string;
  services: Record<string, ServiceHealth>;
  metrics: HealthMetrics;
}

export interface ServiceHealth {
  status: 'up' | 'down' | 'degraded';
  responseTime?: number;
  lastCheck: string;
  error?: string;
}

export interface HealthMetrics {
  memory: NodeJS.MemoryUsage;
  cpu: number;
  activeConnections: number;
  cacheHitRate: number;
  errorRate: number;
}

/**
 * 健康检查器
 * 提供深度的系统健康状态检查
 */
export class HealthChecker {
  private static instance: HealthChecker;
  private metrics: Map<string, number> = new Map();
  
  static getInstance(): HealthChecker {
    if (!HealthChecker.instance) {
      HealthChecker.instance = new HealthChecker();
    }
    return HealthChecker.instance;
  }

  /**
   * 执行完整的健康检查
   */
  async checkHealth(): Promise<HealthStatus> {
    const services: Record<string, ServiceHealth> = {};
    
    // 并行检查所有服务
    const [cacheHealth, databaseHealth, gdstudioHealth] = await Promise.allSettled([
      this.checkCacheHealth(),
      this.checkDatabaseHealth(),
      this.checkGdStudioHealth()
    ]);
    
    services.cache = cacheHealth.status === 'fulfilled' ? cacheHealth.value : {
      status: 'down',
      lastCheck: new Date().toISOString(),
      error: 'Health check failed'
    };
    
    services.database = databaseHealth.status === 'fulfilled' ? databaseHealth.value : {
      status: 'down',
      lastCheck: new Date().toISOString(),
      error: 'Health check failed'
    };
    
    services.gdstudio = gdstudioHealth.status === 'fulfilled' ? gdstudioHealth.value : {
      status: 'down',
      lastCheck: new Date().toISOString(),
      error: 'Health check failed'
    };
    
    // 计算整体状态
    const overallStatus = this.calculateOverallStatus(services);
    
    return {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: '2.0.0',
      services,
      metrics: await this.getMetrics()
    };
  }

  /**
   * 检查缓存服务健康状态
   */
  private async checkCacheHealth(): Promise<ServiceHealth> {
    try {
      const startTime = Date.now();
      const cacheManager = CacheManager.getInstance();
      
      if (!cacheManager.isReady()) {
        return {
          status: 'down',
          lastCheck: new Date().toISOString(),
          error: 'Cache manager not initialized'
        };
      }

      const cache = cacheManager.getCache();
      const testKey = 'health_check_' + Date.now();
      
      // 执行读写测试
      await cache.set(testKey, 'test', 10);
      const result = await cache.get(testKey);
      await cache.del(testKey);
      
      const responseTime = Date.now() - startTime;
      
      return {
        status: result === 'test' ? 'up' : 'degraded',
        responseTime,
        lastCheck: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Cache health check failed', error);
      return {
        status: 'down',
        lastCheck: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * 检查数据库健康状态
   */
  private async checkDatabaseHealth(): Promise<ServiceHealth> {
    try {
      const startTime = Date.now();
      
      // 这里应该添加实际的数据库连接检查
      // 由于当前项目可能没有配置数据库，我们模拟检查
      const databaseUrl = process.env.DATABASE_URL;
      
      if (!databaseUrl) {
        return {
          status: 'down',
          lastCheck: new Date().toISOString(),
          error: 'Database URL not configured'
        };
      }
      
      // 模拟数据库连接检查
      // 在实际项目中，这里应该是：
      // const db = await getDatabaseConnection();
      // await db.$queryRaw`SELECT 1`;
      
      const responseTime = Date.now() - startTime;
      
      return {
        status: 'up',
        responseTime,
        lastCheck: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Database health check failed', error);
      return {
        status: 'down',
        lastCheck: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * 检查 GDStudio API 健康状态
   */
  private async checkGdStudioHealth(): Promise<ServiceHealth> {
    try {
      const startTime = Date.now();
      
      // 简单的连通性检查
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch(
        'https://music-api.gdstudio.xyz/api.php?types=search&name=test&count=1',
        {
          method: 'GET',
          signal: controller.signal,
          headers: {
            'User-Agent': 'UNM-Server-V2-HealthCheck/2.0.0'
          }
        }
      );
      
      clearTimeout(timeoutId);
      const responseTime = Date.now() - startTime;
      
      return {
        status: response.ok ? 'up' : 'degraded',
        responseTime,
        lastCheck: new Date().toISOString()
      };
    } catch (error) {
      return {
        status: 'down',
        lastCheck: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * 计算整体健康状态
   */
  private calculateOverallStatus(services: Record<string, ServiceHealth>): 'healthy' | 'degraded' | 'unhealthy' {
    const statuses = Object.values(services).map(s => s.status);
    const upCount = statuses.filter(s => s === 'up').length;
    const totalCount = statuses.length;
    
    if (upCount === totalCount) {
      return 'healthy';
    } else if (upCount > 0) {
      return 'degraded';
    } else {
      return 'unhealthy';
    }
  }

  /**
   * 获取系统指标
   */
  private async getMetrics(): Promise<HealthMetrics> {
    const cacheManager = CacheManager.getInstance();
    const cacheStats = cacheManager.isReady() ? cacheManager.getCache().getStats() : null;
    
    // 获取 CPU 使用率（简化版）
    const cpuUsage = process.cpuUsage();
    const cpuPercent = (cpuUsage.user + cpuUsage.system) / 1000000; // 转换为秒
    
    return {
      memory: process.memoryUsage(),
      cpu: cpuPercent,
      activeConnections: 0, // 需要实现连接计数
      cacheHitRate: cacheStats?.hitRate || 0,
      errorRate: 0 // 需要实现错误率统计
    };
  }

  /**
   * 快速健康检查（用于负载均衡器）
   */
  async quickCheck(): Promise<{ status: 'ok' | 'error'; timestamp: string }> {
    try {
      // 只检查关键服务
      const cacheManager = CacheManager.getInstance();
      const cacheReady = cacheManager.isReady();
      
      return {
        status: cacheReady ? 'ok' : 'error',
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        status: 'error',
        timestamp: new Date().toISOString()
      };
    }
  }
}
