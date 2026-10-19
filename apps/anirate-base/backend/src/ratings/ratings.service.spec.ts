import { describe, expect, it, jest } from '@jest/globals';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { RatingsService } from './ratings.service';
import { DataService, RatingRecord } from '../data/data.service';

function createRatingsDataMock() {
  const anime = [{ id: 'anilist-21' }];
  const ratings: RatingRecord[] = [];

  return {
    anime,
    ratings,
    findAnimeById: (id: string) => anime.find((entry) => entry.id === id) ?? null,
    save: jest.fn(),
  };
}

describe('RatingsService', () => {
  it('creates one rating per user and anime, then updates it in place', () => {
    const data = createRatingsDataMock();
    const service = new RatingsService(data as unknown as DataService);

    service.upsert('u1', 'anilist-21', { subRating: 4 });
    const updated = service.upsert('u1', 'anilist-21', { dubRating: 2 });

    expect(data.ratings).toHaveLength(1);
    expect(updated).toMatchObject({ subRating: 4, dubRating: 2 });
  });

  it('requires at least one score and an existing anime', () => {
    const service = new RatingsService(createRatingsDataMock() as unknown as DataService);

    expect(() => service.upsert('u1', 'anilist-21', {})).toThrow(BadRequestException);
    expect(() => service.upsert('u1', 'missing', { subRating: 3 })).toThrow(NotFoundException);
  });

  it('buckets sub and dub scores separately in the distribution', () => {
    const service = new RatingsService(createRatingsDataMock() as unknown as DataService);

    service.upsert('u1', 'anilist-21', { subRating: 5, dubRating: 1 });
    service.upsert('u2', 'anilist-21', { subRating: 5 });

    expect(service.getDistribution('anilist-21')).toEqual({
      sub: [0, 0, 0, 0, 2],
      dub: [1, 0, 0, 0, 0],
      totalVotes: 2,
    });
  });

  it('removes only the caller\'s rating', () => {
    const data = createRatingsDataMock();
    const service = new RatingsService(data as unknown as DataService);
    service.upsert('u1', 'anilist-21', { subRating: 5 });
    service.upsert('u2', 'anilist-21', { subRating: 3 });

    service.remove('u1', 'anilist-21');

    expect(data.ratings.map((rating) => rating.userId)).toEqual(['u2']);
  });
});
