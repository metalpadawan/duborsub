import { afterAll, beforeEach, describe, expect, it } from '@jest/globals';
import { BadRequestException } from '@nestjs/common';
import { AnimeService } from '../anime/anime.service';
import { createAnime, createTestPrisma, createUser, resetDatabase } from '../test-utils/database';
import { TitleRequestsService } from './title-requests.service';

const prisma = createTestPrisma();
const service = new TitleRequestsService(prisma, new AnimeService(prisma));

beforeEach(() => resetDatabase(prisma));
afterAll(() => prisma.$disconnect());

describe('TitleRequestsService', () => {
  it('queues a request, with or without an account', async () => {
    const user = await createUser(prisma);

    await expect(service.create({ title: 'Kaiba', details: '2008, Madhouse' }, user.id)).resolves.toMatchObject({ status: 'received' });
    await service.create({ title: 'Mononoke' }, null);

    const pending = await service.list({ status: 'pending', page: 1, limit: 20 });
    expect(pending.items.map((item) => item.title).sort()).toEqual(['Kaiba', 'Mononoke']);
    expect(pending.items.find((item) => item.title === 'Kaiba')?.user).toEqual({ username: user.username });
  });

  it('counts repeat requests for the same show together, most wanted first', async () => {
    await service.create({ title: 'Kaiba' }, null);
    await service.create({ title: 'Mononoke' }, null);
    await expect(service.create({ title: 'mononoke!' }, null)).resolves.toMatchObject({ status: 'already-requested' });

    const pending = await service.list({ status: 'pending', page: 1, limit: 20 });
    expect(pending.items.map((item) => [item.title, item.requestCount])).toEqual([
      ['Mononoke', 2],
      ['Kaiba', 1],
    ]);
  });

  it('suggests titles already in the catalogue', async () => {
    await createAnime(prisma, { id: 'anilist-16498', title: 'Attack on Titan', alternativeTitles: ['Shingeki no Kyojin'] });

    const result = await service.create({ title: 'Shingeki no Kyojin' }, null);

    expect(result.possibleMatches.map((match) => match.id)).toEqual(['anilist-16498']);
  });

  it('drops requests from bots that fill in the hidden field', async () => {
    await expect(service.create({ title: 'Buy now', website: 'http://spam.example' }, null)).resolves.toMatchObject({ status: 'received' });

    expect(await prisma.titleRequest.count()).toBe(0);
  });

  it('settles a request once, as added to the catalogue or rejected', async () => {
    const admin = await createUser(prisma, { role: 'admin' });
    await createAnime(prisma, { id: 'new-1', title: 'Kaiba' });
    await service.create({ title: 'Kaiba' }, null);
    await service.create({ title: 'Nonsense' }, null);
    const [kaiba, nonsense] = (await service.list({ status: 'pending', page: 1, limit: 20 })).items.sort((left, right) => left.title.localeCompare(right.title));

    await expect(service.resolve(admin.id, kaiba.id, { status: 'added', animeId: 'missing' })).rejects.toBeInstanceOf(BadRequestException);
    await service.resolve(admin.id, kaiba.id, { status: 'added', animeId: 'new-1' });
    await service.resolve(admin.id, nonsense.id, { status: 'rejected', note: 'Not an anime' });
    await expect(service.resolve(admin.id, kaiba.id, { status: 'rejected' })).rejects.toThrow('already settled');

    expect((await service.list({ status: 'added', page: 1, limit: 20 })).items[0]).toMatchObject({ title: 'Kaiba', animeId: 'new-1' });
    expect((await service.list({ status: 'rejected', page: 1, limit: 20 })).items[0]).toMatchObject({ adminNote: 'Not an anime' });
    expect(await service.countPending()).toBe(0);
  });
});
