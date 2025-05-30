import type { User, UserRole, Prisma } from '../../generated/client/index.js';
import { BaseService } from './base.js';
import bcrypt from 'bcrypt';

/**
 * 用户创建数据
 */
export interface CreateUserData {
  email: string;
  username: string;
  password: string;
  avatar?: string;
  role?: UserRole;
}

/**
 * 用户更新数据
 */
export interface UpdateUserData {
  email?: string;
  username?: string;
  password?: string;
  avatar?: string;
  role?: UserRole;
  isActive?: boolean;
}

/**
 * 用户查询过滤器
 */
export interface UserFilters {
  email?: string;
  username?: string;
  role?: UserRole;
  isActive?: boolean;
  searchEmail?: string;
  searchUsername?: string;
  createdAt?: {
    from?: Date;
    to?: Date;
  };
}

/**
 * 用户服务类
 */
export class UserService extends BaseService {
  /**
   * 创建用户
   */
  async createUser(data: CreateUserData): Promise<User> {
    try {
      // 验证必需字段
      this.validateRequired(data, ['email', 'username', 'password']);

      // 清理数据
      const cleanedData = this.cleanData(data);

      // 检查邮箱是否已存在
      const existingEmail = await this.db.user.findUnique({
        where: { email: cleanedData.email },
      });
      if (existingEmail) {
        throw new Error('邮箱已被使用');
      }

      // 检查用户名是否已存在
      const existingUsername = await this.db.user.findUnique({
        where: { username: cleanedData.username },
      });
      if (existingUsername) {
        throw new Error('用户名已被使用');
      }

      // 加密密码
      const hashedPassword = await bcrypt.hash(cleanedData.password, 12);

      // 创建用户
      const user = await this.db.user.create({
        data: {
          email: cleanedData.email,
          username: cleanedData.username,
          password: hashedPassword,
          avatar: cleanedData.avatar,
          role: cleanedData.role || 'USER',
        },
      });

      // 移除密码字段
      const { password, ...userWithoutPassword } = user;
      return userWithoutPassword as User;
    } catch (error) {
      this.handleDatabaseError(error, '创建用户');
    }
  }

  /**
   * 根据ID获取用户
   */
  async getUserById(id: string, includePassword: boolean = false): Promise<User | null> {
    try {
      this.validateId(id, '用户ID');

      const user = await this.db.user.findUnique({
        where: { id },
        include: {
          playlists: true,
          favorites: true,
          _count: {
            select: {
              playlists: true,
              favorites: true,
              searchLogs: true,
            },
          },
        },
      });

      if (!user) return null;

      if (!includePassword) {
        const { password, ...userWithoutPassword } = user;
        return userWithoutPassword as any;
      }

      return user;
    } catch (error) {
      this.handleDatabaseError(error, '获取用户');
    }
  }

  /**
   * 根据邮箱获取用户
   */
  async getUserByEmail(email: string, includePassword: boolean = false): Promise<User | null> {
    try {
      if (!email) throw new Error('邮箱不能为空');

      const user = await this.db.user.findUnique({
        where: { email },
      });

      if (!user) return null;

      if (!includePassword) {
        const { password, ...userWithoutPassword } = user;
        return userWithoutPassword as any;
      }

      return user;
    } catch (error) {
      this.handleDatabaseError(error, '根据邮箱获取用户');
    }
  }

  /**
   * 根据用户名获取用户
   */
  async getUserByUsername(username: string, includePassword: boolean = false): Promise<User | null> {
    try {
      if (!username) throw new Error('用户名不能为空');

      const user = await this.db.user.findUnique({
        where: { username },
      });

      if (!user) return null;

      if (!includePassword) {
        const { password, ...userWithoutPassword } = user;
        return userWithoutPassword as any;
      }

      return user;
    } catch (error) {
      this.handleDatabaseError(error, '根据用户名获取用户');
    }
  }

  /**
   * 更新用户
   */
  async updateUser(id: string, data: UpdateUserData): Promise<User> {
    try {
      this.validateId(id, '用户ID');

      // 检查用户是否存在
      await this.checkExists(this.db.user, { id }, '用户不存在');

      // 清理数据
      const cleanedData = this.cleanData(data);
      const updateData: any = { ...cleanedData };

      // 如果更新邮箱，检查是否已被使用
      if (cleanedData.email) {
        const existingEmail = await this.db.user.findFirst({
          where: {
            email: cleanedData.email,
            NOT: { id },
          },
        });
        if (existingEmail) {
          throw new Error('邮箱已被使用');
        }
      }

      // 如果更新用户名，检查是否已被使用
      if (cleanedData.username) {
        const existingUsername = await this.db.user.findFirst({
          where: {
            username: cleanedData.username,
            NOT: { id },
          },
        });
        if (existingUsername) {
          throw new Error('用户名已被使用');
        }
      }

      // 如果更新密码，进行加密
      if (cleanedData.password) {
        updateData.password = await bcrypt.hash(cleanedData.password, 12);
      }

      // 更新用户
      const user = await this.db.user.update({
        where: { id },
        data: updateData,
      });

      // 移除密码字段
      const { password, ...userWithoutPassword } = user;
      return userWithoutPassword as any;
    } catch (error) {
      this.handleDatabaseError(error, '更新用户');
    }
  }

  /**
   * 删除用户
   */
  async deleteUser(id: string): Promise<void> {
    try {
      this.validateId(id, '用户ID');

      // 检查用户是否存在
      await this.checkExists(this.db.user, { id }, '用户不存在');

      // 在事务中删除用户及相关数据
      await this.executeInTransaction(async (tx) => {
        // 删除用户会话
        await tx.userSession.deleteMany({
          where: { userId: id },
        });

        // 删除用户收藏
        await tx.favorite.deleteMany({
          where: { userId: id },
        });

        // 删除用户播放列表
        await tx.playlist.deleteMany({
          where: { userId: id },
        });

        // 删除用户
        await tx.user.delete({
          where: { id },
        });
      });
    } catch (error) {
      this.handleDatabaseError(error, '删除用户');
    }
  }

  /**
   * 获取用户列表
   */
  async getUsers(
    filters: UserFilters = {},
    page?: number,
    limit?: number,
    sortBy?: string,
    sortOrder?: 'asc' | 'desc'
  ) {
    try {
      const { skip, take, page: pageNum, limit: limitNum } = this.getPaginationParams(page, limit);
      const where = this.buildWhereClause(filters);
      const orderBy = this.buildOrderBy(sortBy, sortOrder);

      const [users, total] = await Promise.all([
        this.db.user.findMany({
          where,
          skip,
          take,
          ...(orderBy && { orderBy }),
          select: {
            id: true,
            email: true,
            username: true,
            avatar: true,
            role: true,
            isActive: true,
            createdAt: true,
            updatedAt: true,
            _count: {
              select: {
                playlists: true,
                favorites: true,
                searchLogs: true,
              },
            },
          },
        }),
        this.db.user.count({ where }),
      ]);

      return this.buildPaginatedResponse(users, total, pageNum, limitNum);
    } catch (error) {
      this.handleDatabaseError(error, '获取用户列表');
    }
  }

  /**
   * 验证用户密码
   */
  async validatePassword(email: string, password: string): Promise<User | null> {
    try {
      const user = await this.getUserByEmail(email, true);
      if (!user) return null;

      const isValid = await bcrypt.compare(password, (user as any).password);
      if (!isValid) return null;

      // 移除密码字段
      const { password: _, ...userWithoutPassword } = user as any;
      return userWithoutPassword;
    } catch (error) {
      this.handleDatabaseError(error, '验证密码');
    }
  }

  /**
   * 更新用户最后登录时间
   */
  async updateLastLogin(id: string): Promise<void> {
    try {
      this.validateId(id, '用户ID');

      await this.db.user.update({
        where: { id },
        data: { updatedAt: new Date() },
      });
    } catch (error) {
      this.handleDatabaseError(error, '更新最后登录时间');
    }
  }

  /**
   * 获取用户统计信息
   */
  async getUserStats(): Promise<{
    total: number;
    active: number;
    inactive: number;
    byRole: Record<UserRole, number>;
    recentRegistrations: number;
  }> {
    try {
      const [total, active, inactive, byRole, recentRegistrations] = await Promise.all([
        this.db.user.count(),
        this.db.user.count({ where: { isActive: true } }),
        this.db.user.count({ where: { isActive: false } }),
        this.db.user.groupBy({
          by: ['role'],
          _count: { role: true },
        }),
        this.db.user.count({
          where: {
            createdAt: {
              gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 最近7天
            },
          },
        }),
      ]);

      const roleStats = byRole.reduce((acc, item) => {
        acc[item.role] = item._count.role;
        return acc;
      }, {} as Record<UserRole, number>);

      return {
        total,
        active,
        inactive,
        byRole: roleStats,
        recentRegistrations,
      };
    } catch (error) {
      this.handleDatabaseError(error, '获取用户统计信息');
    }
  }
}
