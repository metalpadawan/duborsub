// RatingsService manages per-user score state and the simple distribution view
// that powers the anime detail page.
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { withAnimeStats } from '../common/prisma/anime-stats';
import { PrismaService } from '../common/prisma/prisma.service';
import { DubReportsService } from '../dub-reports/dub-reports.service';
import { MyRatingsQueryDto, UpsertRatingDto } from './dto/ratings.dto';

@Injectable()
export class RatingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dubReports: DubReportsService,
  ) {}

  async upsert(userId: string, animeId: string, dto: UpsertRatingDto) {
    // A single user keeps one rating record per anime and updates it over time.
    if (dto.subRating === undefined && dto.dubRating === undefined) {
      throw new BadRequestException('Provide at least one rating');
    }

    const anime = await this.prisma.anime.findUnique({ where: { id: animeId }, select: { hasDub: true } });
    if (!anime) {
      throw new NotFoundException('Anime not found');
    }

    const rating = await withAnimeStats(this.prisma, animeId, (tx) =>
      tx.rating.upsert({
        where: { userId_animeId: { userId, animeId } },
        create: { id: randomUUID(), userId, animeId, subRating: dto.subRating ?? null, dubRating: dto.dubRating ?? null },
        update: {
          ...(dto.subRating !== undefined ? { subRating: dto.subRating } : {}),
          ...(dto.dubRating !== undefined ? { dubRating: dto.dubRating } : {}),
        },
      }),
    );

    // Rating a dub means the viewer watched one, which counts as a report that it exists.
    if (dto.dubRating !== undefined && !anime.hasDub) {
      await this.dubReports.report(animeId, userId);
    }

    return rating;
  }

  /** Everything the viewer has rated, most recently changed first. */
  async listMine(userId: string, query: MyRatingsQueryDto) {
    const { page = 1, limit = 20 } = query;
    const [total, ratings] = await Promise.all([
      this.prisma.rating.count({ where: { userId } }),
      this.prisma.rating.findMany({
        where: { userId },
        orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
        select: {
          subRating: true,
          dubRating: true,
          updatedAt: true,
          anime: { select: { id: true, title: true, coverImageUrl: true, releaseYear: true, format: true, hasDub: true } },
        },
      }),
    ]);

    return {
      items: ratings,
      pagination: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) },
    };
  }

  async getMine(userId: string, animeId: string) {
    return (
      (await this.prisma.rating.findUnique({ where: { userId_animeId: { userId, animeId } } })) ?? {
        subRating: null,
        dubRating: null,
      }
    );
  }

  async remove(userId: string, animeId: string) {
    const existing = await this.prisma.rating.findUnique({ where: { userId_animeId: { userId, animeId } }, select: { id: true } });
    if (existing) {
      await withAnimeStats(this.prisma, animeId, (tx) => tx.rating.delete({ where: { id: existing.id } }));
    }

    return { message: 'Rating removed' };
  }

  async getDistribution(animeId: string) {
    // The detail page only needs simple 1-5 bucket counts, so we keep the shape compact.
    const anime = await this.prisma.anime.findUnique({ where: { id: animeId }, select: { id: true } });
    if (!anime) {
      throw new NotFoundException('Anime not found');
    }

    const sub = [0, 0, 0, 0, 0];
    const dub = [0, 0, 0, 0, 0];
    const ratings = await this.prisma.rating.findMany({ where: { animeId }, select: { subRating: true, dubRating: true } });

    ratings.forEach((rating) => {
      if (rating.subRating) sub[rating.subRating - 1] += 1;
      if (rating.dubRating) dub[rating.dubRating - 1] += 1;
    });

    return { sub, dub, totalVotes: ratings.length };
  }
}
