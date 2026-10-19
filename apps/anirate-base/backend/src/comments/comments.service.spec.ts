import { describe, expect, it, jest } from '@jest/globals';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CommentsService } from './comments.service';
import { CreateCommentDto } from './dto/comments.dto';
import { DataService } from '../data/data.service';

function createCommentsDataMock() {
  const now = new Date('2026-01-01T00:00:00.000Z');
  const anime = [
    { id: 'anime-1' },
    { id: 'anime-2' },
  ];
  const users = [
    { id: 'user-1', username: 'demo' },
    { id: 'user-2', username: 'guest' },
  ];
  const comments = [
    {
      id: 'comment-1',
      userId: 'user-1',
      animeId: 'anime-1',
      parentId: null,
      content: 'First comment',
      isDeleted: false,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'comment-2',
      userId: 'user-2',
      animeId: 'anime-2',
      parentId: null,
      content: 'Second anime comment',
      isDeleted: false,
      createdAt: now,
      updatedAt: now,
    },
  ];

  return {
    anime,
    users,
    comments,
    commentLikes: [],
    findAnimeById: (id: string) => anime.find((entry) => entry.id === id) ?? null,
    findUserById: (id: string) => users.find((entry) => entry.id === id) ?? null,
    save: jest.fn(),
  };
}

describe('CommentsService', () => {
  it('rejects replies that target a parent comment from another anime', () => {
    const data = createCommentsDataMock();
    const service = new CommentsService(data as unknown as DataService);

    expect(() =>
      service.create('user-1', 'anime-1', {
        content: 'Reply attempt',
        parentId: 'comment-2',
      }),
    ).toThrow(NotFoundException);
  });

  it('requires nested comment mutations to stay inside the anime route scope', () => {
    const data = createCommentsDataMock();
    const service = new CommentsService(data as unknown as DataService);

    expect(() =>
      service.update('user-2', 'anime-1', 'comment-2', {
        content: 'Trying to edit through the wrong anime route',
      }),
    ).toThrow(NotFoundException);
  });

  it('rejects replies to replies, which the thread view would never show', () => {
    const data = createCommentsDataMock();
    const service = new CommentsService(data as unknown as DataService);
    const reply = service.create('user-2', 'anime-1', { content: 'First reply', parentId: 'comment-1' });

    expect(() =>
      service.create('user-1', 'anime-1', { content: 'Reply to the reply', parentId: reply.id }),
    ).toThrow(BadRequestException);
  });

  it('keeps comment text as typed, including angle brackets and newlines', async () => {
    const dto = plainToInstance(CreateCommentDto, { content: '  a < b, <3\nsecond line\u0007  ' });

    expect(await validate(dto)).toHaveLength(0);
    expect(dto.content).toBe('a < b, <3\nsecond line');
  });

  it('blocks votes against deleted comments', () => {
    const data = createCommentsDataMock();
    data.comments[0].isDeleted = true;
    const service = new CommentsService(data as unknown as DataService);

    expect(() =>
      service.vote('user-2', 'anime-1', 'comment-1', {
        value: 1,
      }),
    ).toThrow(BadRequestException);
  });
});
