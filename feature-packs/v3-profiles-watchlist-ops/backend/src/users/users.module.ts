// ============================================================
// USERS MODULE — public profiles + stats
// ============================================================

// ── users.service.ts ─────────────────────────────────────────
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async getProfile(username: string) {
    const user = await this.prisma.user.findUnique({
      where: { username },
      select: {
        id: true, username: true, role: true, createdAt: true,
        _count: {
          select: {
            ratings: true,
            comments: { where: { isDeleted: false } },
          },
        },
      },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async getRatingHistory(username: string, page = 1, limit = 20) {
    const user = await this.findUserOrFail(username);
    const skip = (page - 1) * limit;

    const [ratings, total] = await this.prisma.$transaction([
      this.prisma.rating.findMany({
        where: { userId: user.id },
        orderBy: { updatedAt: 'desc' },
        skip, take: limit,
        include: {
          anime: {
            select: {
              id: true, title: true, coverImageUrl: true, releaseYear: true,
              animeGenres: { select: { genre: { select: { id: true, name: true } } } },
            },
          },
        },
      }),
      this.prisma.rating.count({ where: { userId: user.id } }),
    ]);

    return {
      items: ratings.map((r) => ({
        ...r,
        anime: {
          ...r.anime,
          genres: r.anime.animeGenres.map((ag) => ag.genre),
          animeGenres: undefined,
        },
      })),
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    };
  }

  async getCommentHistory(username: string, page = 1, limit = 20) {
    const user = await this.findUserOrFail(username);
    const skip = (page - 1) * limit;

    const [comments, total] = await this.prisma.$transaction([
      this.prisma.comment.findMany({
        where: { userId: user.id, isDeleted: false },
        orderBy: { createdAt: 'desc' },
        skip, take: limit,
        include: {
          anime: { select: { id: true, title: true, coverImageUrl: true } },
          _count: { select: { likes: true } },
        },
      }),
      this.prisma.comment.count({ where: { userId: user.id, isDeleted: false } }),
    ]);

    return {
      items: comments,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    };
  }

  // Sub vs Dub preference breakdown — used for profile chart
  async getPreferenceStats(username: string) {
    const user = await this.findUserOrFail(username);

    const ratings = await this.prisma.rating.findMany({
      where: {
        userId: user.id,
        subRating: { not: null },
        dubRating: { not: null },
      },
      select: { subRating: true, dubRating: true },
    });

    const totalBoth = ratings.length;
    let subWins = 0, dubWins = 0, ties = 0;
    let subSum = 0, dubSum = 0;

    for (const r of ratings) {
      subSum += r.subRating!;
      dubSum += r.dubRating!;
      if (r.subRating! > r.dubRating!) subWins++;
      else if (r.dubRating! > r.subRating!) dubWins++;
      else ties++;
    }

    // Distribution across 1-5 stars
    const subOnly = await this.prisma.rating.findMany({
      where: { userId: user.id, subRating: { not: null } },
      select: { subRating: true },
    });
    const dubOnly = await this.prisma.rating.findMany({
      where: { userId: user.id, dubRating: { not: null } },
      select: { dubRating: true },
    });

    const dist = (arr: number[]) =>
      [1, 2, 3, 4, 5].map((star) => ({
        star,
        count: arr.filter((v) => v === star).length,
      }));

    return {
      totalBoth,
      subWins, dubWins, ties,
      avgSub: totalBoth ? (subSum / totalBoth).toFixed(2) : null,
      avgDub: totalBoth ? (dubSum / totalBoth).toFixed(2) : null,
      preference: subWins > dubWins ? 'sub' : dubWins > subWins ? 'dub' : 'balanced',
      subDist: dist(subOnly.map((r) => r.subRating!)),
      dubDist: dist(dubOnly.map((r) => r.dubRating!)),
    };
  }

  // Update own profile (username change, etc.)
  async updateProfile(userId: string, dto: { username?: string }) {
    if (dto.username) {
      const existing = await this.prisma.user.findUnique({ where: { username: dto.username } });
      if (existing && existing.id !== userId) {
        throw new Error('Username already taken');
      }
    }
    return this.prisma.user.update({
      where: { id: userId },
      data: dto,
      select: { id: true, username: true, email: true, role: true },
    });
  }

  private async findUserOrFail(username: string) {
    const user = await this.prisma.user.findUnique({ where: { username } });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }
}

// ── users.controller.ts ───────────────────────────────────────
import {
  Controller, Get, Patch, Param, Query, Body,
  UseGuards, ParseIntPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/strategies/jwt.strategy';
import { CurrentUser } from '../auth/strategies/jwt.strategy';
import { IsOptional, IsString, MinLength, MaxLength, Matches } from 'class-validator';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(30)
  @Matches(/^[a-zA-Z0-9_-]+$/)
  username?: string;
}

@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get(':username')
  getProfile(@Param('username') username: string) {
    return this.usersService.getProfile(username);
  }

  @Get(':username/ratings')
  getRatingHistory(
    @Param('username') username: string,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    return this.usersService.getRatingHistory(username, +page, +limit);
  }

  @Get(':username/comments')
  getCommentHistory(
    @Param('username') username: string,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    return this.usersService.getCommentHistory(username, +page, +limit);
  }

  @Get(':username/stats')
  getStats(@Param('username') username: string) {
    return this.usersService.getPreferenceStats(username);
  }

  @Patch('me')
  @UseGuards(JwtAuthGuard)
  updateProfile(@CurrentUser() user: any, @Body() dto: UpdateProfileDto) {
    return this.usersService.updateProfile(user.id, dto);
  }
}

// ── users.module.ts ───────────────────────────────────────────
import { Module } from '@nestjs/common';

@Module({ controllers: [UsersController], providers: [UsersService] })
export class UsersModule {}
