import { describe, expect, it, jest } from '@jest/globals';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AnimeService } from './anime.service';
import { AnimeRecord, CommentLikeRecord, CommentRecord, DataService, GenreRecord, RatingRecord } from '../data/data.service';

function createAnimeDataMock() {
  const now = new Date('2026-01-01T00:00:00.000Z');
  const genres: GenreRecord[] = [
    { id: 1, name: 'Action' },
    { id: 2, name: 'Drama' },
    { id: 3, name: 'Romance' },
  ];
  const anime: AnimeRecord[] = [
    {
      id: 'anilist-21',
      title: 'One Piece',
      description: '',
      coverImageUrl: null,
      releaseYear: 1999,
      hasDub: true,
      status: 'airing',
      genres: [genres[0]],
      createdAt: now,
      updatedAt: now,
    },
  ];
  const ratings: RatingRecord[] = [
    { id: 'r1', userId: 'u1', animeId: 'anilist-21', subRating: 5, dubRating: 3, createdAt: now, updatedAt: now },
    { id: 'r2', userId: 'u2', animeId: 'other', subRating: 2, dubRating: null, createdAt: now, updatedAt: now },
  ];
  const comments: CommentRecord[] = [
    { id: 'c1', userId: 'u1', animeId: 'anilist-21', parentId: null, content: 'hi', isDeleted: false, createdAt: now, updatedAt: now },
    { id: 'c2', userId: 'u2', animeId: 'other', parentId: null, content: 'yo', isDeleted: false, createdAt: now, updatedAt: now },
  ];
  const commentLikes: CommentLikeRecord[] = [
    { commentId: 'c1', userId: 'u2', value: 1, createdAt: now },
    { commentId: 'c2', userId: 'u1', value: 1, createdAt: now },
  ];

  return {
    genres,
    anime,
    ratings,
    comments,
    commentLikes,
    findAnimeById: (id: string) => anime.find((entry) => entry.id === id) ?? null,
    save: jest.fn(),
  };
}

describe('AnimeService', () => {
  it('serves imported anime whose ids are not UUIDs, with derived rating stats', () => {
    const service = new AnimeService(createAnimeDataMock() as unknown as DataService);

    expect(service.findOne('anilist-21')).toMatchObject({
      id: 'anilist-21',
      avgSubRating: 5,
      avgDubRating: 3,
      totalVotes: 1,
    });
  });

  it('assigns genres from the canonical list even when no anime uses them yet', () => {
    const service = new AnimeService(createAnimeDataMock() as unknown as DataService);

    const updated = service.update('anilist-21', { genreIds: [3] });

    expect(updated.genres).toEqual([{ id: 3, name: 'Romance' }]);
  });

  it('rejects unknown genre ids instead of silently dropping them', () => {
    const service = new AnimeService(createAnimeDataMock() as unknown as DataService);

    expect(() => service.create({ title: 'New', genreIds: [1, 99] })).toThrow(BadRequestException);
  });

  it('removes ratings, comments, and comment votes along with the anime', () => {
    const data = createAnimeDataMock();
    const service = new AnimeService(data as unknown as DataService);

    service.remove('anilist-21');

    expect(data.anime).toHaveLength(0);
    expect(data.ratings.map((rating) => rating.id)).toEqual(['r2']);
    expect(data.comments.map((comment) => comment.id)).toEqual(['c2']);
    expect(data.commentLikes.map((like) => like.commentId)).toEqual(['c2']);
    expect(() => service.findOne('anilist-21')).toThrow(NotFoundException);
  });
});
