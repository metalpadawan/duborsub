import { afterAll, beforeEach, describe, expect, it } from '@jest/globals';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { createAnime, createTestPrisma, createUser, resetDatabase } from '../test-utils/database';
import { CommentsService } from './comments.service';
import { CreateCommentDto } from './dto/comments.dto';

const prisma = createTestPrisma();
const service = new CommentsService(prisma);

beforeEach(async () => {
  await resetDatabase(prisma);
  await createAnime(prisma, { id: 'anime-1' });
  await createAnime(prisma, { id: 'anime-2' });
  await createUser(prisma, { id: 'user-1', username: 'demo' });
  await createUser(prisma, { id: 'user-2', username: 'guest' });
  await prisma.comment.createMany({
    data: [
      { id: 'comment-1', userId: 'user-1', animeId: 'anime-1', content: 'First comment' },
      { id: 'comment-2', userId: 'user-2', animeId: 'anime-2', content: 'Second anime comment' },
    ],
  });
});
afterAll(() => prisma.$disconnect());

describe('CommentsService', () => {
  it('rejects replies that target a parent comment from another anime', async () => {
    await expect(service.create('user-1', 'anime-1', { content: 'Reply attempt', parentId: 'comment-2' })).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('requires nested comment mutations to stay inside the anime route scope', async () => {
    await expect(
      service.update('user-2', 'anime-1', 'comment-2', { content: 'Trying to edit through the wrong anime route' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects replies to replies, which the thread view would never show', async () => {
    const reply = await service.create('user-2', 'anime-1', { content: 'First reply', parentId: 'comment-1' });

    await expect(service.create('user-1', 'anime-1', { content: 'Reply to the reply', parentId: reply.id })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('lists threads with their replies, authors and vote score', async () => {
    await service.create('user-2', 'anime-1', { content: 'A reply', parentId: 'comment-1' });
    await service.vote('user-2', 'anime-1', 'comment-1', { value: 1 });
    await service.vote('user-1', 'anime-1', 'comment-1', { value: -1 });
    await service.vote('user-1', 'anime-1', 'comment-1', { value: 1 });

    const { items, pagination } = await service.list('anime-1', { page: 1, limit: 20 });

    expect(pagination.total).toBe(1);
    expect(items[0]).toMatchObject({
      id: 'comment-1',
      user: { id: 'user-1', username: 'demo' },
      replies: [expect.objectContaining({ content: 'A reply', user: { id: 'user-2', username: 'guest' } })],
      _count: { likes: 2 },
    });
  });

  it('keeps comment text as typed, including angle brackets and newlines', async () => {
    const dto = plainToInstance(CreateCommentDto, { content: '  a < b, <3\nsecond line\u0007  ' });

    expect(await validate(dto)).toHaveLength(0);
    expect(dto.content).toBe('a < b, <3\nsecond line');
  });

  it('blocks votes against deleted comments', async () => {
    await prisma.comment.update({ where: { id: 'comment-1' }, data: { isDeleted: true } });

    await expect(service.vote('user-2', 'anime-1', 'comment-1', { value: 1 })).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('CommentsService moderation', () => {
  it('takes one report per viewer, never on their own note, and lists the most reported first', async () => {
    await createUser(prisma, { id: 'user-3', username: 'third' });

    await expect(service.report('user-1', 'anime-1', 'comment-1', {})).rejects.toBeInstanceOf(BadRequestException);
    await service.report('user-2', 'anime-1', 'comment-1', { reason: 'Spoilers' });
    await service.report('user-2', 'anime-1', 'comment-1', { reason: 'Again' });
    await service.report('user-3', 'anime-1', 'comment-1', {});
    await service.report('user-1', 'anime-2', 'comment-2', { reason: 'Rude' });

    const { items } = await service.listReported();
    expect(items.map((item) => [item.id, item.reports])).toEqual([
      ['comment-1', 2],
      ['comment-2', 1],
    ]);
    expect(items[0]).toMatchObject({ reasons: ['Spoilers'], anime: { id: 'anime-1' }, user: { username: 'demo' } });
  });

  it('settles the reports when a moderator removes the note or dismisses them', async () => {
    await service.report('user-2', 'anime-1', 'comment-1', {});
    await service.report('user-1', 'anime-2', 'comment-2', {});

    await service.softDeleteByAdmin('comment-1');
    await service.dismissReports('comment-2');

    expect((await service.listReported()).items).toEqual([]);
    expect((await service.listRecent(1, 20)).items.find((item) => item.id === 'comment-1')).toMatchObject({ isDeleted: true });
  });
});
