// DubReportsService collects viewers' word that a title has an English dub. No open
// metadata source records dub availability, so the people who watched one are the
// best evidence there is: enough independent reports, or an admin, mark it dubbed.
import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../common/prisma/prisma.service';

// Distinct viewers needed before a title is marked dubbed without an admin.
export const DUB_CONFIRM_THRESHOLD = 3;

@Injectable()
export class DubReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async getState(animeId: string, userId: string | null) {
    const anime = await this.requireAnime(animeId);
    const [reports, mine] = await Promise.all([
      this.prisma.dubReport.count({ where: { animeId } }),
      userId ? this.prisma.dubReport.findUnique({ where: { animeId_userId: { animeId, userId } }, select: { id: true } }) : null,
    ]);

    return { hasDub: anime.hasDub, reports, reportedByMe: Boolean(mine), threshold: DUB_CONFIRM_THRESHOLD };
  }

  async report(animeId: string, userId: string) {
    const anime = await this.requireAnime(animeId);
    if (!anime.hasDub) {
      // One report per viewer: the unique index makes a repeat a no-op.
      await this.prisma.dubReport.createMany({ data: [{ id: randomUUID(), animeId, userId }], skipDuplicates: true });

      if ((await this.prisma.dubReport.count({ where: { animeId } })) >= DUB_CONFIRM_THRESHOLD) {
        await this.markDubbed(animeId);
      }
    }

    return this.getState(animeId, userId);
  }

  async withdraw(animeId: string, userId: string) {
    await this.requireAnime(animeId);
    await this.prisma.dubReport.deleteMany({ where: { animeId, userId } });
    return this.getState(animeId, userId);
  }

  /** Titles with open reports, most-reported first, for the admin queue. */
  async listPending() {
    const groups = await this.prisma.dubReport.groupBy({
      by: ['animeId'],
      _count: { _all: true },
      _max: { createdAt: true },
    });
    const anime = await this.prisma.anime.findMany({
      where: { id: { in: groups.map((group) => group.animeId) } },
      select: { id: true, title: true, releaseYear: true, format: true },
    });
    const byId = new Map(anime.map((entry) => [entry.id, entry]));

    return {
      items: groups
        .flatMap((group) => {
          const entry = byId.get(group.animeId);
          return entry ? [{ anime: entry, reports: group._count._all, latestAt: group._max.createdAt as Date }] : [];
        })
        .sort((left, right) => right.reports - left.reports || right.latestAt.getTime() - left.latestAt.getTime()),
      threshold: DUB_CONFIRM_THRESHOLD,
    };
  }

  /** Sets hasDub and clears the reports that asked for it. */
  async markDubbed(animeId: string) {
    await this.requireAnime(animeId);
    await this.prisma.$transaction([
      this.prisma.anime.update({ where: { id: animeId }, data: { hasDub: true } }),
      this.prisma.dubReport.deleteMany({ where: { animeId } }),
    ]);
  }

  async dismiss(animeId: string) {
    await this.requireAnime(animeId);
    await this.prisma.dubReport.deleteMany({ where: { animeId } });
  }

  private async requireAnime(animeId: string) {
    const anime = await this.prisma.anime.findUnique({ where: { id: animeId }, select: { hasDub: true } });
    if (!anime) {
      throw new NotFoundException('Anime not found');
    }

    return anime;
  }
}
