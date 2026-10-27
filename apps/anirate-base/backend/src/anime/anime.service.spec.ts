import { afterAll, beforeEach, describe, expect, it } from '@jest/globals';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { withAnimeStats } from '../common/prisma/anime-stats';
import { createAnime, createTestPrisma, createUser, resetDatabase } from '../test-utils/database';
import { AnimeService } from './anime.service';

const prisma = createTestPrisma();
const service = new AnimeService(prisma);

async function rate(animeId: string, subRating: number | null, dubRating: number | null) {
  const user = await createUser(prisma);
  await withAnimeStats(prisma, animeId, (tx) =>
    tx.rating.create({ data: { id: randomUUID(), userId: user.id, animeId, subRating, dubRating } }),
  );
}

const ids = (result: { items: Array<{ id: string }> }) => result.items.map((item) => item.id);

beforeEach(() => resetDatabase(prisma));
afterAll(() => prisma.$disconnect());

describe('AnimeService', () => {
  it('serves imported anime whose ids are not UUIDs, with derived rating stats', async () => {
    await createAnime(prisma, { id: 'anilist-21', title: 'One Piece', alternativeTitles: ['ワンピース'] });
    await rate('anilist-21', 5, 3);

    expect(await service.findOne('anilist-21')).toMatchObject({
      id: 'anilist-21',
      avgSubRating: 5,
      avgDubRating: 3,
      totalVotes: 1,
      alternativeTitles: ['ワンピース'],
      dubReports: 0,
    });
  });

  it('finds a title by any of its alternative names, ignoring case and punctuation', async () => {
    await createAnime(prisma, { id: 'anilist-16498', title: 'Shingeki no Kyojin', alternativeTitles: ['Attack on Titan', '進撃の巨人'] });
    await createAnime(prisma, {
      id: 'anilist-21355',
      title: 'Re:Zero kara Hajimeru Isekai Seikatsu',
      alternativeTitles: ['Re:ZERO -Starting Life in Another World-'],
    });

    expect(ids(await service.findAll({ search: 'attack on titan', page: 1, limit: 20 }))).toEqual(['anilist-16498']);
    expect(ids(await service.findAll({ search: 're zero', page: 1, limit: 20 }))).toEqual(['anilist-21355']);
    expect(ids(await service.findAll({ search: '進撃', page: 1, limit: 20 }))).toEqual(['anilist-16498']);
  });

  it('ranks an exact title match above titles that only contain the search', async () => {
    await createAnime(prisma, { id: 'a', title: 'Naruto: Shippuuden' });
    await createAnime(prisma, { id: 'b', title: 'Boruto: Naruto Next Generations' });
    await createAnime(prisma, { id: 'c', title: 'Naruto' });

    expect(ids(await service.findAll({ search: 'naruto', page: 1, limit: 20 }))).toEqual(['c', 'a', 'b']);
  });

  it('keeps a parody that borrows a famous name below the real seasons', async () => {
    await createAnime(prisma, { id: 'aot', title: 'Attack on Titan', popularity: 600_000 });
    await createAnime(prisma, { id: 'aot2', title: 'Attack on Titan Season 2', popularity: 500_000 });
    await createAnime(prisma, { id: 'parody', title: 'Attack on Skytree', alternativeTitles: ['Attack on Titan'], popularity: 900 });

    expect(ids(await service.findAll({ search: 'attack on titan', page: 1, limit: 20 }))).toEqual(['aot', 'aot2', 'parody']);
  });

  it('matches one or two letters at the start of a word, most popular first', async () => {
    await createAnime(prisma, { id: 'kon', title: 'K-On!', popularity: 200_000 });
    await createAnime(prisma, { id: 'koro', title: 'Koro Sensei Quest', popularity: 5_000 });
    await createAnime(prisma, { id: 'inside', title: 'Ikkoku', popularity: 900_000 });

    expect(ids(await service.findAll({ search: 'k', page: 1, limit: 20 }))).toEqual(['kon', 'koro']);
  });

  it('lists titles A to Z, ignoring punctuation, and pages through them', async () => {
    await createAnime(prisma, { id: 'z', title: 'Zetman' });
    await createAnime(prisma, { id: 'o', title: '[Oshi no Ko]' });
    await createAnime(prisma, { id: 'a', title: 'Akira' });

    const firstPage = await service.findAll({ page: 1, limit: 2 });

    expect(firstPage.items.map((item) => item.title)).toEqual(['Akira', '[Oshi no Ko]']);
    expect(firstPage.pagination).toEqual({ page: 1, limit: 2, total: 3, pages: 2 });
  });

  it('ranks only rated titles, by their better version', async () => {
    await createAnime(prisma, { id: 'subbed', title: 'Subbed Well' });
    await createAnime(prisma, { id: 'dubbed', title: 'Dubbed Well' });
    await createAnime(prisma, { id: 'unrated', title: 'Nobody Rated' });
    await rate('subbed', 4, 2);
    await rate('dubbed', 2, 5);

    const ranked = await service.findAll({ sortBy: 'rating', order: 'desc', rated: true, page: 1, limit: 20 });

    expect(ids(ranked)).toEqual(['dubbed', 'subbed']);
    expect(ranked.pagination.total).toBe(2);
  });

  it('orders by popularity with unknown popularity last', async () => {
    await createAnime(prisma, { id: 'obscure', title: 'Aaa Obscure', popularity: null });
    await createAnime(prisma, { id: 'famous', title: 'Famous', popularity: 900_000 });
    await createAnime(prisma, { id: 'known', title: 'Known', popularity: 400_000 });

    expect(ids(await service.findAll({ sortBy: 'popular', page: 1, limit: 20 }))).toEqual(['famous', 'known', 'obscure']);
  });

  it('filters by genre and puts unknown years last', async () => {
    await createAnime(prisma, { id: 'old', title: 'Old', releaseYear: 1963, genreNames: ['Action'] });
    await createAnime(prisma, { id: 'undated', title: 'Undated', releaseYear: null, genreNames: ['Action'] });
    await createAnime(prisma, { id: 'drama', title: 'Drama Only', releaseYear: 2020, genreNames: ['Drama'] });
    const action = await prisma.genre.findUniqueOrThrow({ where: { name: 'Action' } });

    expect(ids(await service.findAll({ genreId: action.id, sortBy: 'year', order: 'asc', page: 1, limit: 20 }))).toEqual([
      'old',
      'undated',
    ]);
  });

  it('assigns genres from the canonical list and rejects unknown ones', async () => {
    await createAnime(prisma, { id: 'anilist-21', title: 'One Piece' });
    const romance = await prisma.genre.create({ data: { name: 'Romance' } });

    const updated = await service.update('anilist-21', { genreIds: [romance.id] });

    expect(updated.genres).toEqual([{ id: romance.id, name: 'Romance' }]);
    await expect(service.create({ title: 'New', genreIds: [romance.id, 999] })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('keeps a renamed title findable under its new and old alternative names', async () => {
    await createAnime(prisma, { id: 'anilist-1', title: 'Cowboy Bebop', alternativeTitles: ['CB'] });

    await service.update('anilist-1', { title: 'Cowboy Bebop (TV)' });

    expect(ids(await service.findAll({ search: 'bebop tv', page: 1, limit: 20 }))).toEqual(['anilist-1']);
    expect(ids(await service.findAll({ search: 'cb', page: 1, limit: 20 }))).toEqual(['anilist-1']);
  });

  it('removes ratings, comments, votes and dub reports along with the anime', async () => {
    await createAnime(prisma, { id: 'anilist-21', title: 'One Piece' });
    const user = await createUser(prisma);
    await rate('anilist-21', 5, null);
    await prisma.comment.create({ data: { id: 'c1', userId: user.id, animeId: 'anilist-21', content: 'hi' } });
    await prisma.commentLike.create({ data: { commentId: 'c1', userId: user.id, value: 1 } });
    await prisma.dubReport.create({ data: { id: 'd1', userId: user.id, animeId: 'anilist-21' } });

    await service.remove('anilist-21');

    expect(await prisma.rating.count()).toBe(0);
    expect(await prisma.comment.count()).toBe(0);
    expect(await prisma.commentLike.count()).toBe(0);
    expect(await prisma.dubReport.count()).toBe(0);
    await expect(service.findOne('anilist-21')).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('AnimeService for admins', () => {
  it('keys in a title with its other names, format and episodes, searchable by any name', async () => {
    const created = await service.create({ title: 'Kaiba', alternativeTitles: ['カイバ', ' Kaiba ', 'Kaiba (2008)'], format: 'TV', episodes: 12 });

    expect(created).toMatchObject({ title: 'Kaiba', format: 'TV', episodes: 12, alternativeTitles: ['カイバ', 'Kaiba (2008)'] });
    expect(ids(await service.findAll({ search: 'カイバ', page: 1, limit: 20 }))).toEqual([created.id]);

    await service.update(created.id, { alternativeTitles: ['Kaiba: The Memory Thief'] });
    expect(ids(await service.findAll({ search: 'memory thief', page: 1, limit: 20 }))).toEqual([created.id]);
  });

  it('lists every id in chunks for the sitemap', async () => {
    await createAnime(prisma, { id: 'a-1' });
    await createAnime(prisma, { id: 'a-2' });
    await createAnime(prisma, { id: 'a-3' });

    const second = await service.sitemap({ page: 2, size: 2 });

    expect(second.total).toBe(3);
    expect(second.items.map((item) => item.id)).toEqual(['a-3']);
  });
});
