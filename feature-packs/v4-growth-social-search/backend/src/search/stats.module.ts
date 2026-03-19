// ============================================================
// STATS MODULE — Sub vs Dub global statistics
// ============================================================

// ── stats.service.ts ──────────────────────────────────────────
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { CacheService } from '../cache/cache.module';

@Injectable()
export class StatsService {
  constructor(
    private prisma: PrismaService,
    private cache: CacheService,
  ) {}

  async getGlobalStats() {
    return this.cache.wrap('stats:global', 1800, () => this.computeGlobal());
  }

  async getGenreBreakdown() {
    return this.cache.wrap('stats:genres', 1800, () => this.computeGenreBreakdown());
  }

  async getTopByCategory() {
    return this.cache.wrap('stats:top', 1800, () => this.computeTopLists());
  }

  async getTrends() {
    return this.cache.wrap('stats:trends', 3600, () => this.computeTrends());
  }

  // ── All stats in one call (for the stats page) ────────────
  async getAll() {
    return this.cache.wrap('stats:all', 1800, async () => {
      const [global, genreBreakdown, top, trends] = await Promise.all([
        this.computeGlobal(),
        this.computeGenreBreakdown(),
        this.computeTopLists(),
        this.computeTrends(),
      ]);
      return { global, genreBreakdown, top, trends };
    });
  }

  // ── Global overview ───────────────────────────────────────
  private async computeGlobal() {
    const [
      totalRatings, totalAnime, totalUsers,
      subStats, dubStats,
    ] = await Promise.all([
      this.prisma.rating.count(),
      this.prisma.anime.count(),
      this.prisma.user.count({ where: { isBanned: false } }),
      this.prisma.rating.aggregate({
        where: { subRating: { not: null } },
        _avg: { subRating: true },
        _count: { subRating: true },
      }),
      this.prisma.rating.aggregate({
        where: { dubRating: { not: null } },
        _avg: { dubRating: true },
        _count: { dubRating: true },
      }),
    ]);

    // Distribution 1-5 for both
    const [subDist, dubDist] = await Promise.all([
      this.prisma.rating.groupBy({
        by: ['subRating'],
        where: { subRating: { not: null } },
        _count: true,
        orderBy: { subRating: 'asc' },
      }),
      this.prisma.rating.groupBy({
        by: ['dubRating'],
        where: { dubRating: { not: null } },
        _count: true,
        orderBy: { dubRating: 'asc' },
      }),
    ]);

    // Head-to-head: among ratings where both sub+dub exist, who wins?
    const bothRated = await this.prisma.$queryRaw<Array<{sub_wins: bigint; dub_wins: bigint; ties: bigint}>>`
      SELECT
        COUNT(*) FILTER (WHERE sub_rating > dub_rating) AS sub_wins,
        COUNT(*) FILTER (WHERE dub_rating > sub_rating) AS dub_wins,
        COUNT(*) FILTER (WHERE sub_rating = dub_rating) AS ties
      FROM ratings
      WHERE sub_rating IS NOT NULL AND dub_rating IS NOT NULL
    `;

    const h2h = bothRated[0];

    return {
      totalRatings, totalAnime, totalUsers,
      sub: {
        avgRating: Number(subStats._avg.subRating ?? 0).toFixed(2),
        totalRatings: subStats._count.subRating,
        distribution: subDist.map(d => ({ star: d.subRating, count: d._count })),
      },
      dub: {
        avgRating: Number(dubStats._avg.dubRating ?? 0).toFixed(2),
        totalRatings: dubStats._count.dubRating,
        distribution: dubDist.map(d => ({ star: d.dubRating, count: d._count })),
      },
      headToHead: {
        subWins:  Number(h2h?.sub_wins  ?? 0),
        dubWins:  Number(h2h?.dub_wins  ?? 0),
        ties:     Number(h2h?.ties      ?? 0),
      },
    };
  }

  // ── Genre breakdown ───────────────────────────────────────
  private async computeGenreBreakdown() {
    const rows = await this.prisma.$queryRaw<Array<{
      genre_name: string;
      avg_sub: number | null;
      avg_dub: number | null;
      total_votes: bigint;
      anime_count: bigint;
    }>>`
      SELECT
        g.name                          AS genre_name,
        AVG(a.avg_sub_rating)::numeric(4,2) AS avg_sub,
        AVG(a.avg_dub_rating)::numeric(4,2) AS avg_dub,
        SUM(a.total_votes)              AS total_votes,
        COUNT(DISTINCT a.id)            AS anime_count
      FROM genres g
      JOIN anime_genres ag ON ag.genre_id = g.id
      JOIN anime a         ON a.id = ag.anime_id
      WHERE a.total_votes >= 3
      GROUP BY g.name
      ORDER BY total_votes DESC
    `;

    return rows.map(r => ({
      genre:       r.genre_name,
      avgSub:      r.avg_sub ? Number(r.avg_sub) : null,
      avgDub:      r.avg_dub ? Number(r.avg_dub) : null,
      totalVotes:  Number(r.total_votes),
      animeCount:  Number(r.anime_count),
      winner:      r.avg_sub && r.avg_dub
        ? r.avg_sub > r.avg_dub ? 'sub'
        : r.avg_dub > r.avg_sub ? 'dub'
        : 'tie'
        : null,
    }));
  }

  // ── Top lists ─────────────────────────────────────────────
  private async computeTopLists() {
    const base = {
      id: true, title: true, coverImageUrl: true,
      avgSubRating: true, avgDubRating: true, totalVotes: true,
    };

    const [topSub, topDub, mostControversial, bestDubUpgrade] = await Promise.all([
      // Top rated sub
      this.prisma.anime.findMany({
        where: { avgSubRating: { not: null }, totalVotes: { gte: 10 } },
        orderBy: { avgSubRating: 'desc' },
        take: 10,
        select: base,
      }),
      // Top rated dub
      this.prisma.anime.findMany({
        where: { avgDubRating: { not: null }, hasDub: true, totalVotes: { gte: 5 } },
        orderBy: { avgDubRating: 'desc' },
        take: 10,
        select: base,
      }),
      // Most controversial: high vote count + big sub/dub gap
      this.prisma.$queryRaw<any[]>`
        SELECT id, title, cover_image_url, avg_sub_rating, avg_dub_rating, total_votes,
               ABS(avg_sub_rating - avg_dub_rating) AS gap
        FROM anime
        WHERE avg_sub_rating IS NOT NULL AND avg_dub_rating IS NOT NULL
          AND total_votes >= 10
        ORDER BY gap DESC
        LIMIT 10
      `,
      // Best dub upgrade: dub_rating - sub_rating is highest
      this.prisma.$queryRaw<any[]>`
        SELECT id, title, cover_image_url, avg_sub_rating, avg_dub_rating, total_votes,
               (avg_dub_rating - avg_sub_rating) AS dub_improvement
        FROM anime
        WHERE avg_sub_rating IS NOT NULL AND avg_dub_rating IS NOT NULL
          AND avg_dub_rating > avg_sub_rating AND total_votes >= 5
        ORDER BY dub_improvement DESC
        LIMIT 10
      `,
    ]);

    return {
      topSub: topSub.map(a => ({ ...a, avgSubRating: Number(a.avgSubRating) })),
      topDub: topDub.map(a => ({ ...a, avgDubRating: Number(a.avgDubRating) })),
      mostControversial: mostControversial.map(r => ({
        id: r.id, title: r.title, coverImageUrl: r.cover_image_url,
        avgSubRating: Number(r.avg_sub_rating), avgDubRating: Number(r.avg_dub_rating),
        totalVotes: Number(r.total_votes), gap: Number(r.gap),
      })),
      bestDubUpgrade: bestDubUpgrade.map(r => ({
        id: r.id, title: r.title, coverImageUrl: r.cover_image_url,
        avgSubRating: Number(r.avg_sub_rating), avgDubRating: Number(r.avg_dub_rating),
        totalVotes: Number(r.total_votes), dubImprovement: Number(r.dub_improvement),
      })),
    };
  }

  // ── Trends (monthly rating counts) ───────────────────────
  private async computeTrends() {
    const rows = await this.prisma.$queryRaw<Array<{
      month: string; sub_count: bigint; dub_count: bigint;
    }>>`
      SELECT
        TO_CHAR(DATE_TRUNC('month', created_at), 'YYYY-MM') AS month,
        COUNT(*) FILTER (WHERE sub_rating IS NOT NULL)       AS sub_count,
        COUNT(*) FILTER (WHERE dub_rating IS NOT NULL)       AS dub_count
      FROM ratings
      WHERE created_at >= NOW() - INTERVAL '12 months'
      GROUP BY month
      ORDER BY month ASC
    `;

    return rows.map(r => ({
      month: r.month,
      subCount: Number(r.sub_count),
      dubCount: Number(r.dub_count),
    }));
  }
}

// ── stats.controller.ts ───────────────────────────────────────
import { Controller, Get } from '@nestjs/common';

@Controller('stats')
export class StatsController {
  constructor(private statsService: StatsService) {}

  @Get()
  getAll() { return this.statsService.getAll(); }

  @Get('global')
  global() { return this.statsService.getGlobalStats(); }

  @Get('genres')
  genres() { return this.statsService.getGenreBreakdown(); }

  @Get('top')
  top() { return this.statsService.getTopByCategory(); }

  @Get('trends')
  trends() { return this.statsService.getTrends(); }
}

// ── stats.module.ts ───────────────────────────────────────────
import { Module } from '@nestjs/common';

@Module({
  controllers: [StatsController],
  providers: [StatsService],
})
export class StatsModule {}
