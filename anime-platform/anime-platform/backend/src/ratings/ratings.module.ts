// ============================================================
// RATINGS MODULE
// ============================================================

// ── ratings.dto.ts ────────────────────────────────────────────
import { IsOptional, IsInt, Min, Max } from 'class-validator';

export class UpsertRatingDto {
  @IsOptional() @IsInt() @Min(1) @Max(5) subRating?: number;
  @IsOptional() @IsInt() @Min(1) @Max(5) dubRating?: number;
}

// ── ratings.service.ts ────────────────────────────────────────
import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

@Injectable()
export class RatingsService {
  constructor(private prisma: PrismaService) {}

  async upsert(userId: string, animeId: string, dto: UpsertRatingDto) {
    if (dto.subRating == null && dto.dubRating == null) {
      throw new BadRequestException('At least one of subRating or dubRating is required');
    }

    // Verify anime exists
    const anime = await this.prisma.anime.findUnique({ where: { id: animeId } });
    if (!anime) throw new NotFoundException('Anime not found');

    if (dto.dubRating && !anime.hasDub) {
      throw new BadRequestException('This anime does not have a dub version');
    }

    const rating = await this.prisma.rating.upsert({
      where: { userId_animeId: { userId, animeId } },
      update: {
        ...(dto.subRating !== undefined && { subRating: dto.subRating }),
        ...(dto.dubRating !== undefined && { dubRating: dto.dubRating }),
      },
      create: { userId, animeId, subRating: dto.subRating, dubRating: dto.dubRating },
    });

    return rating;
  }

  async findUserRating(userId: string, animeId: string) {
    return this.prisma.rating.findUnique({
      where: { userId_animeId: { userId, animeId } },
    });
  }

  async delete(userId: string, animeId: string) {
    const rating = await this.prisma.rating.findUnique({
      where: { userId_animeId: { userId, animeId } },
    });
    if (!rating) throw new NotFoundException('Rating not found');

    await this.prisma.rating.delete({ where: { userId_animeId: { userId, animeId } } });
    return { message: 'Rating removed' };
  }

  async getAnimeRatingDistribution(animeId: string) {
    const [subDist, dubDist] = await Promise.all([
      this.prisma.rating.groupBy({
        by: ['subRating'],
        where: { animeId, subRating: { not: null } },
        _count: true,
      }),
      this.prisma.rating.groupBy({
        by: ['dubRating'],
        where: { animeId, dubRating: { not: null } },
        _count: true,
      }),
    ]);

    return { sub: subDist, dub: dubDist };
  }
}

// ── ratings.controller.ts ─────────────────────────────────────
import {
  Controller, Post, Delete, Get, Param, Body,
  UseGuards, ParseUUIDPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/strategies/jwt.strategy';
import { CurrentUser } from '../auth/strategies/jwt.strategy';

@Controller('anime/:animeId/ratings')
export class RatingsController {
  constructor(private ratingsService: RatingsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  upsert(
    @Param('animeId', ParseUUIDPipe) animeId: string,
    @Body() dto: UpsertRatingDto,
    @CurrentUser() user: any,
  ) {
    return this.ratingsService.upsert(user.id, animeId, dto);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  myRating(
    @Param('animeId', ParseUUIDPipe) animeId: string,
    @CurrentUser() user: any,
  ) {
    return this.ratingsService.findUserRating(user.id, animeId);
  }

  @Delete()
  @UseGuards(JwtAuthGuard)
  remove(
    @Param('animeId', ParseUUIDPipe) animeId: string,
    @CurrentUser() user: any,
  ) {
    return this.ratingsService.delete(user.id, animeId);
  }

  @Get('distribution')
  distribution(@Param('animeId', ParseUUIDPipe) animeId: string) {
    return this.ratingsService.getAnimeRatingDistribution(animeId);
  }
}

// ── ratings.module.ts ─────────────────────────────────────────
import { Module } from '@nestjs/common';

@Module({
  controllers: [RatingsController],
  providers: [RatingsService],
})
export class RatingsModule {}
