// ============================================================
// WATCHLIST MODULE
// ============================================================

// ── Prisma schema additions (append to schema.prisma) ────────
/*
enum WatchlistStatus {
  plan_to_watch
  watching
  completed
  dropped
  on_hold
}

model WatchlistEntry {
  id        String          @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  userId    String          @map("user_id") @db.Uuid
  animeId   String          @map("anime_id") @db.Uuid
  status    WatchlistStatus @default(plan_to_watch)
  note      String?         @db.VarChar(500)
  createdAt DateTime        @default(now()) @map("created_at") @db.Timestamptz()
  updatedAt DateTime        @updatedAt      @map("updated_at") @db.Timestamptz()

  user  User  @relation(fields: [userId],  references: [id], onDelete: Cascade)
  anime Anime @relation(fields: [animeId], references: [id], onDelete: Cascade)

  @@unique([userId, animeId])
  @@map("watchlist_entries")
}
*/

// ── SQL migration (run in psql or via Prisma migrate) ─────────
/*
CREATE TYPE watchlist_status AS ENUM (
  'plan_to_watch', 'watching', 'completed', 'dropped', 'on_hold'
);

CREATE TABLE watchlist_entries (
  id         UUID              PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID              NOT NULL REFERENCES users  (id) ON DELETE CASCADE,
  anime_id   UUID              NOT NULL REFERENCES anime  (id) ON DELETE CASCADE,
  status     watchlist_status  NOT NULL DEFAULT 'plan_to_watch',
  note       VARCHAR(500),
  created_at TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, anime_id)
);

CREATE INDEX idx_watchlist_user   ON watchlist_entries (user_id, status);
CREATE INDEX idx_watchlist_anime  ON watchlist_entries (anime_id);
*/

// ── watchlist.dto.ts ──────────────────────────────────────────
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export enum WatchlistStatus {
  plan_to_watch = 'plan_to_watch',
  watching      = 'watching',
  completed     = 'completed',
  dropped       = 'dropped',
  on_hold       = 'on_hold',
}

export class UpsertWatchlistDto {
  @IsEnum(WatchlistStatus)
  status: WatchlistStatus;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

// ── watchlist.service.ts ──────────────────────────────────────
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

const ANIME_MINI = {
  id: true, title: true, coverImageUrl: true,
  releaseYear: true, hasDub: true, avgSubRating: true, avgDubRating: true,
};

@Injectable()
export class WatchlistService {
  constructor(private prisma: PrismaService) {}

  async getList(userId: string, status?: WatchlistStatus) {
    const entries = await this.prisma.watchlistEntry.findMany({
      where: { userId, ...(status ? { status } : {}) },
      orderBy: { updatedAt: 'desc' },
      include: { anime: { select: ANIME_MINI } },
    });

    // Group by status for the "my list" view
    const grouped = Object.values(WatchlistStatus).reduce(
      (acc, s) => ({ ...acc, [s]: [] as any[] }),
      {} as Record<WatchlistStatus, any[]>,
    );
    for (const entry of entries) {
      grouped[entry.status as WatchlistStatus].push(entry);
    }

    return { entries, grouped, total: entries.length };
  }

  async upsert(userId: string, animeId: string, dto: UpsertWatchlistDto) {
    const anime = await this.prisma.anime.findUnique({ where: { id: animeId } });
    if (!anime) throw new NotFoundException('Anime not found');

    return this.prisma.watchlistEntry.upsert({
      where: { userId_animeId: { userId, animeId } },
      update: { status: dto.status as any, note: dto.note },
      create: { userId, animeId, status: dto.status as any, note: dto.note },
      include: { anime: { select: ANIME_MINI } },
    });
  }

  async remove(userId: string, animeId: string) {
    const entry = await this.prisma.watchlistEntry.findUnique({
      where: { userId_animeId: { userId, animeId } },
    });
    if (!entry) throw new NotFoundException('Entry not found');
    await this.prisma.watchlistEntry.delete({
      where: { userId_animeId: { userId, animeId } },
    });
    return { message: 'Removed from watchlist' };
  }

  async getStatus(userId: string, animeId: string) {
    return this.prisma.watchlistEntry.findUnique({
      where: { userId_animeId: { userId, animeId } },
      select: { status: true, note: true },
    });
  }

  async getStats(userId: string) {
    const counts = await this.prisma.watchlistEntry.groupBy({
      by: ['status'],
      where: { userId },
      _count: true,
    });
    return counts.reduce(
      (acc, c) => ({ ...acc, [c.status]: c._count }),
      {} as Record<string, number>,
    );
  }
}

// ── watchlist.controller.ts ───────────────────────────────────
import {
  Controller, Get, Post, Delete, Param, Body, Query,
  UseGuards, ParseUUIDPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/strategies/jwt.strategy';
import { CurrentUser } from '../auth/strategies/jwt.strategy';

@Controller('watchlist')
@UseGuards(JwtAuthGuard)
export class WatchlistController {
  constructor(private watchlistService: WatchlistService) {}

  @Get()
  getList(@CurrentUser() user: any, @Query('status') status?: WatchlistStatus) {
    return this.watchlistService.getList(user.id, status);
  }

  @Get('stats')
  getStats(@CurrentUser() user: any) {
    return this.watchlistService.getStats(user.id);
  }

  @Post(':animeId')
  upsert(
    @Param('animeId', ParseUUIDPipe) animeId: string,
    @Body() dto: UpsertWatchlistDto,
    @CurrentUser() user: any,
  ) {
    return this.watchlistService.upsert(user.id, animeId, dto);
  }

  @Get(':animeId/status')
  getStatus(
    @Param('animeId', ParseUUIDPipe) animeId: string,
    @CurrentUser() user: any,
  ) {
    return this.watchlistService.getStatus(user.id, animeId);
  }

  @Delete(':animeId')
  remove(
    @Param('animeId', ParseUUIDPipe) animeId: string,
    @CurrentUser() user: any,
  ) {
    return this.watchlistService.remove(user.id, animeId);
  }
}

// ── watchlist.module.ts ───────────────────────────────────────
import { Module } from '@nestjs/common';

@Module({ controllers: [WatchlistController], providers: [WatchlistService] })
export class WatchlistModule {}
