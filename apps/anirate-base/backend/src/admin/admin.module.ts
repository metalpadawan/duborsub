// ============================================================
// ADMIN MODULE
// All routes require role: admin (enforced via RolesGuard)
// ============================================================

// ── admin.dto.ts ──────────────────────────────────────────────
import { IsOptional, IsString, IsDateString, MaxLength, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';

export class BanUserDto {
  @IsOptional() @IsString() @MaxLength(500) reason?: string;
  @IsOptional() @IsDateString() bannedUntil?: string; // omit for permanent
}

export class AdminQueryDto {
  @IsOptional() @Type(() => Number) page?: number = 1;
  @IsOptional() @Type(() => Number) limit?: number = 20;
  @IsOptional() @IsString() search?: string;
}

// ── admin.service.ts ──────────────────────────────────────────
import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

  // ── User management ────────────────────────────────────────
  async listUsers(query: AdminQueryDto) {
    const { page, limit, search } = query;
    const skip = (page - 1) * limit;

    const where = search
      ? { OR: [{ username: { contains: search, mode: 'insensitive' as const } },
               { email: { contains: search, mode: 'insensitive' as const } }] }
      : {};

    const [users, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where, skip, take: limit,
        select: {
          id: true, username: true, email: true, role: true,
          isBanned: true, bannedUntil: true, createdAt: true,
          _count: { select: { ratings: true, comments: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where }),
    ]);

    return { users, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
  }

  async banUser(adminId: string, userId: string, dto: BanUserDto, ip: string) {
    if (adminId === userId) throw new ForbiddenException('Cannot ban yourself');

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    if (user.role === 'admin') throw new ForbiddenException('Cannot ban another admin');

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: {
          isBanned: true,
          banReason: dto.reason,
          bannedUntil: dto.bannedUntil ? new Date(dto.bannedUntil) : null,
        },
      }),
      // Revoke all sessions
      this.prisma.refreshToken.updateMany({
        where: { userId },
        data: { revokedAt: new Date() },
      }),
      this.prisma.adminLog.create({
        data: {
          adminId, action: 'BAN_USER', targetType: 'user', targetId: userId,
          ipAddress: ip,
          metadata: { reason: dto.reason, bannedUntil: dto.bannedUntil },
        },
      }),
    ]);

    return { message: 'User banned' };
  }

  async unbanUser(adminId: string, userId: string, ip: string) {
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: { isBanned: false, banReason: null, bannedUntil: null },
      }),
      this.prisma.adminLog.create({
        data: { adminId, action: 'UNBAN_USER', targetType: 'user', targetId: userId, ipAddress: ip },
      }),
    ]);
    return { message: 'User unbanned' };
  }

  // ── Comment moderation ─────────────────────────────────────
  async deleteComment(adminId: string, commentId: string, ip: string) {
    const comment = await this.prisma.comment.findUnique({ where: { id: commentId } });
    if (!comment) throw new NotFoundException('Comment not found');

    await this.prisma.$transaction([
      this.prisma.comment.update({
        where: { id: commentId },
        data: { isDeleted: true, content: '[removed by moderator]' },
      }),
      this.prisma.adminLog.create({
        data: {
          adminId, action: 'DELETE_COMMENT', targetType: 'comment', targetId: commentId,
          ipAddress: ip,
        },
      }),
    ]);

    return { message: 'Comment removed' };
  }

  // ── Analytics ──────────────────────────────────────────────
  async getDashboardStats() {
    const [
      totalUsers, totalAnime, totalRatings, totalComments,
      topRatedAnime, recentActivity,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.anime.count(),
      this.prisma.rating.count(),
      this.prisma.comment.count({ where: { isDeleted: false } }),
      this.prisma.anime.findMany({
        orderBy: { totalVotes: 'desc' },
        take: 10,
        select: { id: true, title: true, avgSubRating: true, avgDubRating: true, totalVotes: true },
      }),
      this.prisma.adminLog.findMany({
        orderBy: { createdAt: 'desc' },
        take: 20,
        include: { admin: { select: { username: true } } },
      }),
    ]);

    return {
      counts: { totalUsers, totalAnime, totalRatings, totalComments },
      topRatedAnime,
      recentActivity,
    };
  }

  async getAdminLogs(query: AdminQueryDto) {
    const { page, limit } = query;
    const skip = (page - 1) * limit;
    const [logs, total] = await this.prisma.$transaction([
      this.prisma.adminLog.findMany({
        skip, take: limit,
        orderBy: { createdAt: 'desc' },
        include: { admin: { select: { username: true } } },
      }),
      this.prisma.adminLog.count(),
    ]);
    return { logs, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
  }
}

// ── admin.controller.ts ───────────────────────────────────────
import {
  Controller, Get, Post, Delete, Param, Body, Query,
  UseGuards, ParseUUIDPipe, HttpCode, HttpStatus, Req,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/strategies/jwt.strategy';
import { RolesGuard, Roles } from '../auth/strategies/jwt.strategy';
import { CurrentUser } from '../auth/strategies/jwt.strategy';
import { Request } from 'express';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class AdminController {
  constructor(private adminService: AdminService) {}

  @Get('dashboard')
  dashboard() {
    return this.adminService.getDashboardStats();
  }

  @Get('users')
  listUsers(@Query() query: AdminQueryDto) {
    return this.adminService.listUsers(query);
  }

  @Post('users/:id/ban')
  banUser(
    @Param('id', ParseUUIDPipe) userId: string,
    @Body() dto: BanUserDto,
    @CurrentUser() admin: any,
    @Req() req: Request,
  ) {
    return this.adminService.banUser(admin.id, userId, dto, req.ip ?? '');
  }

  @Post('users/:id/unban')
  unbanUser(
    @Param('id', ParseUUIDPipe) userId: string,
    @CurrentUser() admin: any,
    @Req() req: Request,
  ) {
    return this.adminService.unbanUser(admin.id, userId, req.ip ?? '');
  }

  @Delete('comments/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteComment(
    @Param('id', ParseUUIDPipe) commentId: string,
    @CurrentUser() admin: any,
    @Req() req: Request,
  ) {
    return this.adminService.deleteComment(admin.id, commentId, req.ip ?? '');
  }

  @Get('logs')
  getLogs(@Query() query: AdminQueryDto) {
    return this.adminService.getAdminLogs(query);
  }
}

// ── admin.module.ts ───────────────────────────────────────────
import { Module } from '@nestjs/common';

@Module({
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
