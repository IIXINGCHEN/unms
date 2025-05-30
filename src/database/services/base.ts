import type { PrismaClient } from '../../generated/client/index.js';
import { getDatabase } from '../client.js';

/**
 * 基础服务类
 */
export abstract class BaseService {
  protected db: PrismaClient;

  constructor(db?: PrismaClient) {
    this.db = db || getDatabase();
  }

  /**
   * 分页查询辅助方法
   */
  protected getPaginationParams(page?: number, limit?: number) {
    const pageNum = Math.max(1, page || 1);
    const limitNum = Math.min(100, Math.max(1, limit || 20));

    return {
      skip: (pageNum - 1) * limitNum,
      take: limitNum,
      page: pageNum,
      limit: limitNum,
    };
  }

  /**
   * 构建分页响应
   */
  protected buildPaginatedResponse<T>(
    data: T[],
    total: number,
    page: number,
    limit: number
  ) {
    const totalPages = Math.ceil(total / limit);

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    };
  }

  /**
   * 处理数据库错误
   */
  protected handleDatabaseError(error: any, operation: string): never {
    console.error(`数据库操作失败 [${operation}]:`, error);

    // Prisma错误处理
    if (error.code) {
      switch (error.code) {
        case 'P2002':
          throw new Error('数据已存在，违反唯一约束');
        case 'P2025':
          throw new Error('记录不存在');
        case 'P2003':
          throw new Error('外键约束违反');
        case 'P2016':
          throw new Error('查询解释错误');
        case 'P2021':
          throw new Error('表不存在');
        default:
          throw new Error(`数据库错误: ${error.message}`);
      }
    }

    throw new Error(`${operation}操作失败: ${error.message}`);
  }

  /**
   * 软删除辅助方法
   */
  protected async softDelete(
    model: any,
    id: string,
    deletedAtField: string = 'deletedAt'
  ): Promise<void> {
    try {
      await model.update({
        where: { id },
        data: { [deletedAtField]: new Date() },
      });
    } catch (error) {
      this.handleDatabaseError(error, '软删除');
    }
  }

  /**
   * 批量操作辅助方法
   */
  protected async batchOperation<T>(
    items: T[],
    operation: (item: T) => Promise<any>,
    batchSize: number = 100
  ): Promise<any[]> {
    const results: any[] = [];

    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(item => operation(item))
      );
      results.push(...batchResults);
    }

    return results;
  }

  /**
   * 事务执行辅助方法
   */
  protected async executeInTransaction<T>(
    operation: (tx: any) => Promise<T>
  ): Promise<T> {
    try {
      return await this.db.$transaction(operation as any) as T;
    } catch (error) {
      this.handleDatabaseError(error, '事务执行');
    }
  }

  /**
   * 条件查询构建器
   */
  protected buildWhereClause(filters: Record<string, any>): Record<string, any> {
    const where: Record<string, any> = {};

    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        if (typeof value === 'string' && key.includes('search')) {
          // 模糊搜索
          where[key.replace('search', '')] = {
            contains: value,
            mode: 'insensitive',
          };
        } else if (Array.isArray(value)) {
          // 数组查询
          where[key] = { in: value };
        } else if (typeof value === 'object' && value.from && value.to) {
          // 范围查询
          where[key] = {
            gte: value.from,
            lte: value.to,
          };
        } else {
          where[key] = value;
        }
      }
    });

    return where;
  }

  /**
   * 排序构建器
   */
  protected buildOrderBy(
    sortBy?: string,
    sortOrder?: 'asc' | 'desc'
  ): Record<string, any> | undefined {
    if (!sortBy) return undefined;

    return {
      [sortBy]: sortOrder || 'desc',
    };
  }

  /**
   * 字段选择构建器
   */
  protected buildSelect(fields?: string[]): Record<string, boolean> | undefined {
    if (!fields || fields.length === 0) return undefined;

    const select: Record<string, boolean> = {};
    fields.forEach(field => {
      select[field] = true;
    });

    return select;
  }

  /**
   * 关联查询构建器
   */
  protected buildInclude(includes?: string[]): Record<string, any> | undefined {
    if (!includes || includes.length === 0) return undefined;

    const include: Record<string, any> = {};
    includes.forEach(relation => {
      include[relation] = true;
    });

    return include;
  }

  /**
   * 数据验证辅助方法
   */
  protected validateRequired(data: Record<string, any>, requiredFields: string[]): void {
    const missingFields = requiredFields.filter(field =>
      data[field] === undefined || data[field] === null || data[field] === ''
    );

    if (missingFields.length > 0) {
      throw new Error(`缺少必需字段: ${missingFields.join(', ')}`);
    }
  }

  /**
   * 数据清理辅助方法
   */
  protected cleanData(data: Record<string, any>): Record<string, any> {
    const cleaned: Record<string, any> = {};

    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        if (typeof value === 'string') {
          cleaned[key] = value.trim();
        } else {
          cleaned[key] = value;
        }
      }
    });

    return cleaned;
  }

  /**
   * ID验证辅助方法
   */
  protected validateId(id: string, fieldName: string = 'ID'): void {
    if (!id || typeof id !== 'string' || id.trim().length === 0) {
      throw new Error(`无效的${fieldName}`);
    }
  }

  /**
   * 检查记录是否存在
   */
  protected async checkExists(
    model: any,
    where: Record<string, any>,
    errorMessage?: string
  ): Promise<void> {
    const exists = await model.findFirst({ where });
    if (!exists) {
      throw new Error(errorMessage || '记录不存在');
    }
  }

  /**
   * 获取或创建记录
   */
  protected async findOrCreate<T>(
    model: any,
    where: Record<string, any>,
    create: Record<string, any>
  ): Promise<T> {
    try {
      let record = await model.findFirst({ where });

      if (!record) {
        record = await model.create({ data: create });
      }

      return record;
    } catch (error) {
      this.handleDatabaseError(error, '查找或创建');
    }
  }
}
