// AdminService provides moderation actions plus simple aggregate views for dashboard pages.
import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { CommentsService } from '../comments/comments.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { DubReportsService } from '../dub-reports/dub-reports.service';
import { MonitoringService } from '../monitoring/monitoring.service';
import { ResolveTitleRequestDto, TitleRequestQueryDto } from '../title-requests/dto/title-requests.dto';
import { TitleRequestsService } from '../title-requests/title-requests.service';
import { AdminQueryDto, BanUserDto, ChangeRoleDto } from './dto/admin.dto';

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly commentsService: CommentsService,
    private readonly monitoring: MonitoringService,
    private readonly dubReports: DubReportsService,
    private readonly titleRequests: TitleRequestsService,
  ) {}

  listTitleRequests(query: TitleRequestQueryDto) {
    return this.titleRequests.list(query);
  }

  async resolveTitleRequest(adminId: string, id: string, dto: ResolveTitleRequestDto, ipAddress: string) {
    const result = await this.titleRequests.resolve(adminId, id, dto);
    await this.pushLog(adminId, dto.status === 'added' ? 'ADD_REQUESTED_TITLE' : 'REJECT_TITLE_REQUEST', 'title_request', id, ipAddress, {
      title: result.title,
      animeId: dto.animeId ?? null,
    });
    return { message: result.message };
  }

  listReportedComments() {
    return this.commentsService.listReported();
  }

  listRecentComments(query: AdminQueryDto) {
    return this.commentsService.listRecent(query.page ?? 1, query.limit ?? 20);
  }

  async dismissCommentReports(adminId: string, commentId: string, ipAddress: string) {
    await this.commentsService.dismissReports(commentId);
    await this.pushLog(adminId, 'DISMISS_COMMENT_REPORTS', 'comment', commentId, ipAddress, null);
    return { message: 'Reports dismissed' };
  }

  async getDashboardStats() {
    // The dashboard stays intentionally simple: totals, a small top list, and recent admin events.
    const [totalUsers, totalAnime, totalRatings, totalComments, dubGroups, topRatedAnime, recentActivity, pendingTitleRequests, reportGroups] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.anime.count(),
      this.prisma.rating.count(),
      this.prisma.comment.count({ where: { isDeleted: false } }),
      this.prisma.dubReport.groupBy({ by: ['animeId'] }),
      // Highest better-version average among rated titles; votes break ties.
      this.prisma.anime.findMany({
        where: { totalVotes: { gt: 0 } },
        orderBy: [{ bestRating: { sort: 'desc', nulls: 'last' } }, { totalVotes: 'desc' }],
        take: 5,
        select: { id: true, title: true },
      }),
      this.prisma.adminLog.findMany({ orderBy: { createdAt: 'desc' }, take: 20 }),
      this.titleRequests.countPending(),
      this.prisma.commentReport.groupBy({ by: ['commentId'] }),
    ]);

    return {
      counts: {
        totalUsers,
        totalAnime,
        totalRatings,
        totalComments,
        pendingDubReports: dubGroups.length,
        pendingTitleRequests,
        reportedComments: reportGroups.length,
      },
      topRatedAnime,
      recentActivity,
    };
  }

  listDubReports() {
    return this.dubReports.listPending();
  }

  async confirmDub(adminId: string, animeId: string, ipAddress: string) {
    await this.dubReports.markDubbed(animeId);
    await this.pushLog(adminId, 'CONFIRM_DUB', 'anime', animeId, ipAddress, null);
    return { message: 'Dub confirmed' };
  }

  async dismissDubReports(adminId: string, animeId: string, ipAddress: string) {
    await this.dubReports.dismiss(animeId);
    await this.pushLog(adminId, 'DISMISS_DUB_REPORTS', 'anime', animeId, ipAddress, null);
    return { message: 'Dub reports dismissed' };
  }

  async listUsers(query: AdminQueryDto) {
    const { search, page = 1, limit = 20 } = query;
    const where: Prisma.UserWhereInput = search
      ? {
          OR: [
            { username: { contains: search, mode: 'insensitive' } },
            { email: { contains: search, mode: 'insensitive' } },
          ],
        }
      : {};

    const [total, users] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
        select: { id: true, username: true, email: true, role: true, isBanned: true, createdAt: true },
      }),
    ]);

    return {
      items: users,
      pagination: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) },
    };
  }

  async banUser(adminId: string, userId: string, dto: BanUserDto, ipAddress: string) {
    // Moderation actions always write an audit log entry so the admin UI has activity history.
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.id === adminId || user.role === 'admin') {
      throw new ForbiddenException('Admin accounts require a higher-privilege moderation workflow');
    }

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: user.id },
        data: {
          isBanned: true,
          banReason: dto.reason ?? null,
          bannedUntil: dto.durationDays ? new Date(Date.now() + dto.durationDays * 24 * 60 * 60 * 1000) : null,
        },
      }),
      this.prisma.refreshToken.updateMany({ where: { userId: user.id, revokedAt: null }, data: { revokedAt: new Date() } }),
    ]);
    await this.pushLog(adminId, 'BAN_USER', 'user', user.id, ipAddress, {
      reason: dto.reason ?? null,
      durationDays: dto.durationDays ?? null,
    });
    this.monitoring.recordSecurityEvent({
      type: 'admin.user_banned',
      severity: 'warning',
      message: 'An administrator banned a user and revoked active sessions',
      userId: user.id,
      ipAddress: ipAddress || null,
      metadata: { adminId },
    });

    return { message: 'User banned' };
  }

  // Admins promote members and step other admins down. Nobody changes their own role,
  // so the last admin cannot lock everyone out by mistake.
  async changeRole(adminId: string, userId: string, dto: ChangeRoleDto, ipAddress: string) {
    if (userId === adminId) {
      throw new ForbiddenException('You cannot change your own role');
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true, role: true, isBanned: true, emailVerifiedAt: true } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (dto.role === 'admin' && (user.isBanned || !user.emailVerifiedAt)) {
      throw new ForbiddenException('Only members in good standing with a confirmed email can become admins');
    }

    if (user.role !== dto.role) {
      await this.prisma.user.update({ where: { id: userId }, data: { role: dto.role } });
      await this.pushLog(adminId, dto.role === 'admin' ? 'GRANT_ADMIN' : 'REVOKE_ADMIN', 'user', userId, ipAddress, null);
      this.monitoring.recordSecurityEvent({
        type: dto.role === 'admin' ? 'admin.role_granted' : 'admin.role_revoked',
        severity: 'warning',
        message: dto.role === 'admin' ? 'An administrator made a member an admin' : 'An administrator removed admin rights',
        userId,
        ipAddress: ipAddress || null,
        metadata: { adminId },
      });
    }

    return { message: dto.role === 'admin' ? 'Now an admin' : 'Now a member' };
  }

  async unbanUser(adminId: string, userId: string, ipAddress: string) {
    const { count } = await this.prisma.user.updateMany({
      where: { id: userId },
      data: { isBanned: false, banReason: null, bannedUntil: null },
    });
    if (count === 0) {
      throw new NotFoundException('User not found');
    }

    await this.pushLog(adminId, 'UNBAN_USER', 'user', userId, ipAddress, null);
    this.monitoring.recordSecurityEvent({
      type: 'admin.user_unbanned',
      severity: 'info',
      message: 'An administrator restored a user account',
      userId,
      ipAddress: ipAddress || null,
      metadata: { adminId },
    });
    return { message: 'User unbanned' };
  }

  async deleteComment(adminId: string, commentId: string, ipAddress: string) {
    await this.commentsService.softDeleteByAdmin(commentId);
    await this.pushLog(adminId, 'DELETE_COMMENT', 'comment', commentId, ipAddress, null);
    this.monitoring.recordSecurityEvent({
      type: 'admin.comment_deleted',
      severity: 'info',
      message: 'An administrator removed a comment',
      ipAddress: ipAddress || null,
      metadata: { adminId, commentId },
    });
    return { message: 'Comment removed' };
  }

  async getAdminLogs(query: AdminQueryDto) {
    const { page = 1, limit = 20 } = query;
    const [total, logs] = await Promise.all([
      this.prisma.adminLog.count(),
      this.prisma.adminLog.findMany({
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
        include: { admin: { select: { username: true } } },
      }),
    ]);

    return {
      items: logs,
      pagination: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) },
    };
  }

  private async pushLog(
    adminId: string,
    action: string,
    targetType: string | null,
    targetId: string | null,
    ipAddress: string,
    metadata: Prisma.InputJsonObject | null,
  ) {
    await this.prisma.adminLog.create({
      data: {
        id: randomUUID(),
        adminId,
        action,
        targetType,
        targetId,
        metadata: metadata ?? Prisma.JsonNull,
        ipAddress: ipAddress || null,
      },
    });
  }
}
