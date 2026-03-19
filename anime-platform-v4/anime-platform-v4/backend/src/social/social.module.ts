// ============================================================
// SOCIAL MODULE — follows + activity feed
// ============================================================

// ── Prisma schema additions ───────────────────────────────────
/*
model Follow {
  followerId  String   @map("follower_id")  @db.Uuid
  followingId String   @map("following_id") @db.Uuid
  createdAt   DateTime @default(now()) @map("created_at") @db.Timestamptz()

  follower  User @relation("UserFollowers", fields: [followerId],  references: [id], onDelete: Cascade)
  following User @relation("UserFollowing", fields: [followingId], references: [id], onDelete: Cascade)

  @@id([followerId, followingId])
  @@map("follows")
}

// Add to User model:
//   followers Follow[] @relation("UserFollowers")
//   following Follow[] @relation("UserFollowing")
*/

// ── SQL migration ─────────────────────────────────────────────
/*
CREATE TABLE follows (
  follower_id  UUID        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  following_id UUID        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (follower_id, following_id),
  CHECK (follower_id <> following_id)
);
CREATE INDEX idx_follows_follower  ON follows (follower_id);
CREATE INDEX idx_follows_following ON follows (following_id);
*/

// ── social.service.ts ─────────────────────────────────────────
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { CacheService } from '../cache/cache.module';

const FEED_LIMIT    = 30;
const FEED_CACHE_S  = 120; // 2 min

@Injectable()
export class SocialService {
  constructor(
    private prisma: PrismaService,
    private cache: CacheService,
  ) {}

  // ── Follow / unfollow ──────────────────────────────────────
  async follow(followerId: string, username: string) {
    const target = await this.prisma.user.findUnique({ where: { username } });
    if (!target) throw new NotFoundException('User not found');
    if (target.id === followerId) throw new BadRequestException('Cannot follow yourself');

    await this.prisma.follow.upsert({
      where: { followerId_followingId: { followerId, followingId: target.id } },
      update: {},
      create: { followerId, followingId: target.id },
    });

    await this.cache.del(`feed:${followerId}`);
    return { following: true, username: target.username };
  }

  async unfollow(followerId: string, username: string) {
    const target = await this.prisma.user.findUnique({ where: { username } });
    if (!target) throw new NotFoundException('User not found');

    await this.prisma.follow.deleteMany({
      where: { followerId, followingId: target.id },
    });

    await this.cache.del(`feed:${followerId}`);
    return { following: false, username: target.username };
  }

  async isFollowing(followerId: string, username: string) {
    const target = await this.prisma.user.findUnique({ where: { username } });
    if (!target) return { following: false };
    const rec = await this.prisma.follow.findUnique({
      where: { followerId_followingId: { followerId, followingId: target.id } },
    });
    return { following: !!rec };
  }

  // ── Follower / following lists ─────────────────────────────
  async getFollowers(username: string) {
    const user = await this.findOrFail(username);
    const follows = await this.prisma.follow.findMany({
      where: { followingId: user.id },
      include: { follower: { select: { id: true, username: true, createdAt: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return follows.map(f => f.follower);
  }

  async getFollowing(username: string) {
    const user = await this.findOrFail(username);
    const follows = await this.prisma.follow.findMany({
      where: { followerId: user.id },
      include: { following: { select: { id: true, username: true, createdAt: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return follows.map(f => f.following);
  }

  // ── Activity feed ──────────────────────────────────────────
  async getFeed(userId: string, cursor?: string) {
    const cacheKey = `feed:${userId}:${cursor ?? 'start'}`;
    return this.cache.wrap(cacheKey, FEED_CACHE_S, () => this.buildFeed(userId, cursor));
  }

  private async buildFeed(userId: string, cursor?: string) {
    // Get IDs of users this user follows
    const follows = await this.prisma.follow.findMany({
      where: { followerId: userId },
      select: { followingId: true },
    });
    const followingIds = follows.map(f => f.followingId);

    if (followingIds.length === 0) {
      return { items: [], hasMore: false, nextCursor: null };
    }

    const cursorDate = cursor ? new Date(cursor) : undefined;

    // Fetch recent ratings from followed users
    const [ratings, comments] = await Promise.all([
      this.prisma.rating.findMany({
        where: {
          userId: { in: followingIds },
          ...(cursorDate ? { updatedAt: { lt: cursorDate } } : {}),
        },
        orderBy: { updatedAt: 'desc' },
        take: FEED_LIMIT,
        include: {
          user:  { select: { id: true, username: true } },
          anime: { select: { id: true, title: true, coverImageUrl: true } },
        },
      }),
      this.prisma.comment.findMany({
        where: {
          userId: { in: followingIds },
          isDeleted: false,
          ...(cursorDate ? { createdAt: { lt: cursorDate } } : {}),
        },
        orderBy: { createdAt: 'desc' },
        take: FEED_LIMIT,
        include: {
          user:  { select: { id: true, username: true } },
          anime: { select: { id: true, title: true, coverImageUrl: true } },
        },
      }),
    ]);

    // Merge and sort by date
    const items = [
      ...ratings.map(r => ({
        type: 'rating' as const,
        id: r.id,
        user: r.user,
        anime: r.anime,
        subRating: r.subRating,
        dubRating: r.dubRating,
        timestamp: r.updatedAt,
      })),
      ...comments.map(c => ({
        type: 'comment' as const,
        id: c.id,
        user: c.user,
        anime: c.anime,
        content: c.content,
        timestamp: c.createdAt,
      })),
    ]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, FEED_LIMIT);

    const hasMore = items.length === FEED_LIMIT;
    const nextCursor = hasMore ? items[items.length - 1].timestamp.toISOString() : null;

    return { items, hasMore, nextCursor };
  }

  private async findOrFail(username: string) {
    const user = await this.prisma.user.findUnique({ where: { username } });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }
}

// ── social.controller.ts ──────────────────────────────────────
import {
  Controller, Get, Post, Delete, Param, Query,
  UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/strategies/jwt.strategy';
import { CurrentUser } from '../auth/strategies/jwt.strategy';

@Controller('social')
export class SocialController {
  constructor(private socialService: SocialService) {}

  @Post('follow/:username')
  @UseGuards(JwtAuthGuard)
  follow(@Param('username') username: string, @CurrentUser() user: any) {
    return this.socialService.follow(user.id, username);
  }

  @Delete('follow/:username')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  unfollow(@Param('username') username: string, @CurrentUser() user: any) {
    return this.socialService.unfollow(user.id, username);
  }

  @Get('follow/:username/status')
  @UseGuards(JwtAuthGuard)
  isFollowing(@Param('username') username: string, @CurrentUser() user: any) {
    return this.socialService.isFollowing(user.id, username);
  }

  @Get('followers/:username')
  getFollowers(@Param('username') username: string) {
    return this.socialService.getFollowers(username);
  }

  @Get('following/:username')
  getFollowing(@Param('username') username: string) {
    return this.socialService.getFollowing(username);
  }

  @Get('feed')
  @UseGuards(JwtAuthGuard)
  getFeed(@CurrentUser() user: any, @Query('cursor') cursor?: string) {
    return this.socialService.getFeed(user.id, cursor);
  }
}

// ── social.module.ts ──────────────────────────────────────────
import { Module } from '@nestjs/common';

@Module({
  controllers: [SocialController],
  providers: [SocialService],
})
export class SocialModule {}
