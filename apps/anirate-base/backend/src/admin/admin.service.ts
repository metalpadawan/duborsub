// AdminService provides moderation actions plus simple aggregate views for dashboard pages.
import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { CommentsService } from '../comments/comments.service';
import { DataService } from '../data/data.service';
import { AdminQueryDto, BanUserDto } from './dto/admin.dto';

@Injectable()
export class AdminService {
  constructor(
    private readonly data: DataService,
    private readonly commentsService: CommentsService,
  ) {}

  getDashboardStats() {
    // The dashboard stays intentionally simple: totals, a small top list, and recent admin events.
    return {
      counts: {
        totalUsers: this.data.users.length,
        totalAnime: this.data.anime.length,
        totalRatings: this.data.ratings.length,
        totalComments: this.data.comments.filter((comment) => !comment.isDeleted).length,
      },
      topRatedAnime: this.data.anime.slice(0, 5).map((anime) => ({
        id: anime.id,
        title: anime.title,
      })),
      recentActivity: this.data.adminLogs.slice(-20).reverse(),
    };
  }

  listUsers(query: AdminQueryDto) {
    const { search, page = 1, limit = 20 } = query;
    let users = [...this.data.users];

    if (search) {
      const needle = search.toLowerCase();
      users = users.filter(
        (user) =>
          user.username.toLowerCase().includes(needle) ||
          user.email.toLowerCase().includes(needle),
      );
    }

    const total = users.length;
    const start = (page - 1) * limit;
    return {
      items: users.slice(start, start + limit).map((user) => ({
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        isBanned: user.isBanned,
        createdAt: user.createdAt,
      })),
      pagination: {
        page,
        limit,
        total,
        pages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  banUser(adminId: string, userId: string, dto: BanUserDto, ipAddress: string) {
    // Moderation actions always write an audit log entry so the admin UI has activity history.
    const user = this.data.findUserById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    user.isBanned = true;
    user.banReason = dto.reason ?? null;
    user.bannedUntil = dto.durationDays
      ? new Date(Date.now() + dto.durationDays * 24 * 60 * 60 * 1000)
      : null;
    user.updatedAt = new Date();

    this.pushLog(adminId, 'BAN_USER', 'user', user.id, ipAddress, {
      reason: dto.reason ?? null,
      durationDays: dto.durationDays ?? null,
    });
    this.data.save();

    return { message: 'User banned' };
  }

  unbanUser(adminId: string, userId: string, ipAddress: string) {
    const user = this.data.findUserById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    user.isBanned = false;
    user.banReason = null;
    user.bannedUntil = null;
    user.updatedAt = new Date();

    this.pushLog(adminId, 'UNBAN_USER', 'user', user.id, ipAddress, null);
    this.data.save();
    return { message: 'User unbanned' };
  }

  deleteComment(adminId: string, commentId: string, ipAddress: string) {
    this.commentsService.softDeleteByAdmin(commentId);
    this.pushLog(adminId, 'DELETE_COMMENT', 'comment', commentId, ipAddress, null);
    this.data.save();
    return { message: 'Comment removed' };
  }

  getAdminLogs(query: AdminQueryDto) {
    const { page = 1, limit = 20 } = query;
    const total = this.data.adminLogs.length;
    const ordered = [...this.data.adminLogs].sort(
      (left, right) => right.createdAt.getTime() - left.createdAt.getTime(),
    );
    const start = (page - 1) * limit;

    return {
      items: ordered.slice(start, start + limit).map((log) => ({
        ...log,
        admin: this.data.findUserById(log.adminId)
          ? { username: this.data.findUserById(log.adminId)?.username }
          : null,
      })),
      pagination: {
        page,
        limit,
        total,
        pages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  private pushLog(
    adminId: string,
    action: string,
    targetType: string | null,
    targetId: string | null,
    ipAddress: string,
    metadata: Record<string, unknown> | null,
  ) {
    this.data.adminLogs.push({
      id: randomUUID(),
      adminId,
      action,
      targetType,
      targetId,
      metadata,
      ipAddress: ipAddress || null,
      createdAt: new Date(),
    });
  }
}
