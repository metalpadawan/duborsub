import { afterAll, beforeEach, describe, expect, it } from '@jest/globals';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DubReportsService } from '../dub-reports/dub-reports.service';
import { createAnime, createTestPrisma, createUser, resetDatabase } from '../test-utils/database';
import { RatingsService } from './ratings.service';

const prisma = createTestPrisma();
const service = new RatingsService(prisma, new DubReportsService(prisma));

beforeEach(() => resetDatabase(prisma));
afterAll(() => prisma.$disconnect());

describe('RatingsService', () => {
  it('creates one rating per user and anime, updates it in place, and keeps the totals in step', async () => {
    await createAnime(prisma, { id: 'anilist-21', hasDub: true });
    const user = await createUser(prisma);

    await service.upsert(user.id, 'anilist-21', { subRating: 4 });
    const updated = await service.upsert(user.id, 'anilist-21', { dubRating: 2 });

    expect(updated).toMatchObject({ subRating: 4, dubRating: 2 });
    expect(await prisma.rating.count()).toBe(1);
    expect(await prisma.anime.findUnique({ where: { id: 'anilist-21' } })).toMatchObject({
      totalVotes: 1,
      avgSubRating: 4,
      avgDubRating: 2,
      bestRating: 4,
    });
  });

  it('keeps the totals right when many viewers rate at once', async () => {
    await createAnime(prisma, { id: 'busy', hasDub: true });
    const users = await Promise.all(Array.from({ length: 8 }, () => createUser(prisma)));

    await Promise.all(users.map((user, index) => service.upsert(user.id, 'busy', { subRating: (index % 5) + 1 })));

    const anime = await prisma.anime.findUniqueOrThrow({ where: { id: 'busy' } });
    expect(anime.totalVotes).toBe(8);
    expect(anime.subSum).toBe([1, 2, 3, 4, 5, 1, 2, 3].reduce((sum, value) => sum + value, 0));
  });

  it('requires at least one score and an existing anime', async () => {
    const user = await createUser(prisma);
    await createAnime(prisma, { id: 'anilist-21' });

    await expect(service.upsert(user.id, 'anilist-21', {})).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.upsert(user.id, 'missing', { subRating: 3 })).rejects.toBeInstanceOf(NotFoundException);
  });

  it('buckets sub and dub scores separately in the distribution', async () => {
    await createAnime(prisma, { id: 'anilist-21', hasDub: true });
    const [one, two] = await Promise.all([createUser(prisma), createUser(prisma)]);

    await service.upsert(one.id, 'anilist-21', { subRating: 5, dubRating: 1 });
    await service.upsert(two.id, 'anilist-21', { subRating: 5 });

    expect(await service.getDistribution('anilist-21')).toEqual({ sub: [0, 0, 0, 0, 2], dub: [1, 0, 0, 0, 0], totalVotes: 2 });
  });

  it("removes only the caller's rating and recounts", async () => {
    await createAnime(prisma, { id: 'anilist-21' });
    const [one, two] = await Promise.all([createUser(prisma), createUser(prisma)]);
    await service.upsert(one.id, 'anilist-21', { subRating: 5 });
    await service.upsert(two.id, 'anilist-21', { subRating: 3 });

    await service.remove(one.id, 'anilist-21');

    expect((await prisma.rating.findMany()).map((rating) => rating.userId)).toEqual([two.id]);
    expect(await prisma.anime.findUnique({ where: { id: 'anilist-21' } })).toMatchObject({ totalVotes: 1, avgSubRating: 3 });
  });

  it('counts a dub rating on a title with no dub on record as a dub report', async () => {
    await createAnime(prisma, { id: 'anilist-21', hasDub: false });
    const user = await createUser(prisma);

    await service.upsert(user.id, 'anilist-21', { dubRating: 4 });
    await service.upsert(user.id, 'anilist-21', { dubRating: 5 });

    expect((await prisma.dubReport.findMany()).map((report) => report.userId)).toEqual([user.id]);
  });

  it("lists the viewer's own ratings, newest first", async () => {
    await createAnime(prisma, { id: 'anilist-21', title: 'One Piece' });
    await createAnime(prisma, { id: 'mal-5114', title: 'Fullmetal Alchemist: Brotherhood' });
    const [me, other] = await Promise.all([createUser(prisma), createUser(prisma)]);

    await service.upsert(me.id, 'anilist-21', { subRating: 3 });
    await service.upsert(other.id, 'mal-5114', { subRating: 1 });
    await service.upsert(me.id, 'mal-5114', { subRating: 5 });

    const mine = await service.listMine(me.id, { page: 1, limit: 20 });
    expect(mine.items.map((item) => item.anime.id)).toEqual(['mal-5114', 'anilist-21']);
    expect(mine.pagination.total).toBe(2);
  });
});
