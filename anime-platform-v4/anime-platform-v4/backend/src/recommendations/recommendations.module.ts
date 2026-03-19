// ============================================================
// RECOMMENDATION ENGINE
// Strategy: user-based collaborative filtering
//   1. Find users with similar rating patterns (cosine similarity)
//   2. Recommend anime those similar users rated highly
//   3. Cache results per user — recompute on rating changes
// ============================================================

// ── recommendations.service.ts ───────────────────────────────
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { CacheService } from '../cache/cache.module';

const MIN_RATINGS_FOR_RECS = 3;   // user needs at least this many ratings
const SIMILAR_USERS_POOL   = 20;  // how many similar users to consider
const REC_LIMIT            = 12;  // how many recommendations to return
const CACHE_TTL            = 3600; // 1 hour

type RatingMap = Map<string, number>; // animeId → avg score (sub+dub mean)

@Injectable()
export class RecommendationsService {
  private readonly logger = new Logger(RecommendationsService.name);

  constructor(
    private prisma: PrismaService,
    private cache: CacheService,
  ) {}

  // ── Public entrypoints ────────────────────────────────────

  async getForUser(userId: string) {
    const cacheKey = `recs:user:${userId}`;
    return this.cache.wrap(cacheKey, CACHE_TTL, () => this.compute(userId));
  }

  async getPopular(limit = 12) {
    return this.cache.wrap('recs:popular', 3600, () =>
      this.prisma.anime.findMany({
        where: { totalVotes: { gt: 0 } },
        orderBy: { totalVotes: 'desc' },
        take: limit,
        select: {
          id: true, title: true, coverImageUrl: true,
          avgSubRating: true, avgDubRating: true, totalVotes: true,
          releaseYear: true, hasDub: true,
          animeGenres: { select: { genre: { select: { id: true, name: true } } } },
        },
      }).then(rows => rows.map(r => ({
        ...r,
        genres: r.animeGenres.map(ag => ag.genre),
        animeGenres: undefined,
        reason: 'Popular in the community',
      }))),
    );
  }

  async getSimilarAnime(animeId: string, limit = 8) {
    const cacheKey = `recs:similar:${animeId}`;
    return this.cache.wrap(cacheKey, 3600, () => this.computeSimilar(animeId, limit));
  }

  // Invalidate user recs when they rate something new
  async invalidateForUser(userId: string) {
    await this.cache.del(`recs:user:${userId}`);
  }

  // ── Core collaborative filter ─────────────────────────────

  private async compute(userId: string) {
    // Load the target user's ratings
    const myRatings = await this.loadUserRatings(userId);

    if (myRatings.size < MIN_RATINGS_FOR_RECS) {
      // Cold start — return popular + genre-based fallback
      return { type: 'popular', items: await this.getPopular() };
    }

    // Load ratings for all other users who share ≥1 anime
    const myAnimeIds = [...myRatings.keys()];
    const candidates = await this.prisma.rating.findMany({
      where: {
        animeId: { in: myAnimeIds },
        userId: { not: userId },
      },
      select: { userId: true },
      distinct: ['userId'],
    });

    const candidateIds = candidates.map(c => c.userId);
    if (candidateIds.length === 0) {
      return { type: 'popular', items: await this.getPopular() };
    }

    // Load candidate ratings in bulk
    const allRatings = await this.prisma.rating.findMany({
      where: { userId: { in: candidateIds } },
      select: { userId: true, animeId: true, subRating: true, dubRating: true },
    });

    // Group by userId
    const userRatingMaps = new Map<string, RatingMap>();
    for (const r of allRatings) {
      if (!userRatingMaps.has(r.userId)) userRatingMaps.set(r.userId, new Map());
      const score = this.avgScore(r.subRating, r.dubRating);
      if (score !== null) userRatingMaps.get(r.userId)!.set(r.animeId, score);
    }

    // Compute cosine similarity between target user and each candidate
    const similarities: { userId: string; sim: number }[] = [];
    for (const [uid, theirMap] of userRatingMaps) {
      const sim = this.cosineSimilarity(myRatings, theirMap);
      if (sim > 0) similarities.push({ userId: uid, sim });
    }

    // Sort by similarity, take top N
    similarities.sort((a, b) => b.sim - a.sim);
    const topNeighbors = similarities.slice(0, SIMILAR_USERS_POOL);

    // Collect anime the target user hasn't seen, weighted by neighbor similarity
    const scores = new Map<string, { score: number; weight: number; count: number }>();
    for (const { userId: nId, sim } of topNeighbors) {
      const theirMap = userRatingMaps.get(nId)!;
      for (const [animeId, rating] of theirMap) {
        if (myRatings.has(animeId)) continue; // already rated
        if (rating < 3.5) continue;           // only recommend well-rated anime

        const existing = scores.get(animeId) ?? { score: 0, weight: 0, count: 0 };
        scores.set(animeId, {
          score:  existing.score  + rating * sim,
          weight: existing.weight + sim,
          count:  existing.count  + 1,
        });
      }
    }

    // Normalise weighted scores
    const ranked = [...scores.entries()]
      .map(([animeId, { score, weight, count }]) => ({
        animeId,
        predictedScore: weight > 0 ? score / weight : 0,
        supportCount: count,
      }))
      .filter(r => r.supportCount >= 2)  // need at least 2 neighbors to agree
      .sort((a, b) => b.predictedScore - a.predictedScore)
      .slice(0, REC_LIMIT);

    if (ranked.length === 0) {
      return { type: 'popular', items: await this.getPopular() };
    }

    // Hydrate with anime details
    const animeIds = ranked.map(r => r.animeId);
    const anime = await this.prisma.anime.findMany({
      where: { id: { in: animeIds } },
      select: {
        id: true, title: true, coverImageUrl: true,
        avgSubRating: true, avgDubRating: true, totalVotes: true,
        releaseYear: true, hasDub: true,
        animeGenres: { select: { genre: { select: { id: true, name: true } } } },
      },
    });

    const animeMap = new Map(anime.map(a => [a.id, a]));
    const items = ranked
      .map(r => {
        const a = animeMap.get(r.animeId);
        if (!a) return null;
        return {
          ...a,
          genres: a.animeGenres.map(ag => ag.genre),
          animeGenres: undefined,
          predictedScore: Math.round(r.predictedScore * 10) / 10,
          supportCount: r.supportCount,
          reason: `${r.supportCount} users with similar taste loved this`,
        };
      })
      .filter(Boolean);

    return { type: 'collaborative', neighborCount: topNeighbors.length, items };
  }

  // ── Similar anime (item-based, genre + rating overlap) ────

  private async computeSimilar(animeId: string, limit: number) {
    const target = await this.prisma.anime.findUnique({
      where: { id: animeId },
      include: { animeGenres: true },
    });
    if (!target) return [];

    const genreIds = target.animeGenres.map(ag => ag.genreId);
    if (genreIds.length === 0) return [];

    // Find anime sharing genres, excluding the target
    const candidates = await this.prisma.anime.findMany({
      where: {
        id: { not: animeId },
        animeGenres: { some: { genreId: { in: genreIds } } },
        totalVotes: { gte: 5 },
      },
      select: {
        id: true, title: true, coverImageUrl: true,
        avgSubRating: true, avgDubRating: true, totalVotes: true,
        releaseYear: true, hasDub: true,
        animeGenres: { select: { genreId: true, genre: { select: { id: true, name: true } } } },
      },
      take: 50,
    });

    // Score by genre overlap + rating similarity
    const targetAvg = this.avgScore(
      target.avgSubRating ? Number(target.avgSubRating) : null,
      target.avgDubRating ? Number(target.avgDubRating) : null,
    ) ?? 3;

    const scored = candidates.map(c => {
      const sharedGenres = c.animeGenres.filter(ag => genreIds.includes(ag.genreId)).length;
      const genreScore = sharedGenres / genreIds.length;
      const cAvg = this.avgScore(
        c.avgSubRating ? Number(c.avgSubRating) : null,
        c.avgDubRating ? Number(c.avgDubRating) : null,
      ) ?? 3;
      const ratingProximity = 1 - Math.abs(targetAvg - cAvg) / 5;
      return {
        ...c,
        genres: c.animeGenres.map(ag => ag.genre),
        animeGenres: undefined,
        similarity: genreScore * 0.7 + ratingProximity * 0.3,
        sharedGenres,
      };
    });

    return scored
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);
  }

  // ── Math helpers ──────────────────────────────────────────

  private avgScore(sub: number | null | undefined, dub: number | null | undefined): number | null {
    if (sub != null && dub != null) return (sub + dub) / 2;
    if (sub != null) return sub;
    if (dub != null) return dub;
    return null;
  }

  private async loadUserRatings(userId: string): Promise<RatingMap> {
    const ratings = await this.prisma.rating.findMany({
      where: { userId },
      select: { animeId: true, subRating: true, dubRating: true },
    });
    const map: RatingMap = new Map();
    for (const r of ratings) {
      const score = this.avgScore(r.subRating, r.dubRating);
      if (score !== null) map.set(r.animeId, score);
    }
    return map;
  }

  private cosineSimilarity(a: RatingMap, b: RatingMap): number {
    // Only consider shared anime
    const shared = [...a.keys()].filter(id => b.has(id));
    if (shared.length === 0) return 0;

    let dot = 0, magA = 0, magB = 0;
    for (const id of shared) {
      const va = a.get(id)!, vb = b.get(id)!;
      dot  += va * vb;
      magA += va * va;
      magB += vb * vb;
    }
    const denom = Math.sqrt(magA) * Math.sqrt(magB);
    return denom === 0 ? 0 : dot / denom;
  }
}

// ── recommendations.controller.ts ────────────────────────────
import { Controller, Get, Param, UseGuards, ParseUUIDPipe, Query } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/strategies/jwt.strategy';
import { CurrentUser } from '../auth/strategies/jwt.strategy';

@Controller('recommendations')
export class RecommendationsController {
  constructor(private recsService: RecommendationsService) {}

  @Get('me')
  @UseGuards(JwtAuthGuard)
  forMe(@CurrentUser() user: any) {
    return this.recsService.getForUser(user.id);
  }

  @Get('popular')
  popular(@Query('limit') limit = 12) {
    return this.recsService.getPopular(+limit);
  }

  @Get('similar/:animeId')
  similar(
    @Param('animeId', ParseUUIDPipe) animeId: string,
    @Query('limit') limit = 8,
  ) {
    return this.recsService.getSimilarAnime(animeId, +limit);
  }
}

// ── recommendations.module.ts ─────────────────────────────────
import { Module } from '@nestjs/common';

@Module({
  controllers: [RecommendationsController],
  providers: [RecommendationsService],
  exports: [RecommendationsService],
})
export class RecommendationsModule {}

// ── Integration: invalidate recs on new ratings ───────────────
// In RatingsService.upsert(), after the prisma upsert:
//   await this.recsService.invalidateForUser(userId);
