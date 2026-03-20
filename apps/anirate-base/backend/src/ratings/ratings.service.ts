// RatingsService manages per-user score state and the simple distribution view
// that powers the anime detail page.
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { DataService } from '../data/data.service';
import { UpsertRatingDto } from './dto/ratings.dto';

@Injectable()
export class RatingsService {
  constructor(private readonly data: DataService) {}

  upsert(userId: string, animeId: string, dto: UpsertRatingDto) {
    // A single user can keep one rating record per anime and update it over time.
    if (dto.subRating === undefined && dto.dubRating === undefined) {
      throw new BadRequestException('Provide at least one rating');
    }

    const anime = this.data.findAnimeById(animeId);
    if (!anime) {
      throw new NotFoundException('Anime not found');
    }

    const existing = this.data.ratings.find((rating) => rating.userId === userId && rating.animeId === animeId);
    if (existing) {
      if (dto.subRating !== undefined) existing.subRating = dto.subRating;
      if (dto.dubRating !== undefined) existing.dubRating = dto.dubRating;
      existing.updatedAt = new Date();
      return existing;
    }

    const created = {
      id: randomUUID(),
      userId,
      animeId,
      subRating: dto.subRating ?? null,
      dubRating: dto.dubRating ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.data.ratings.push(created);
    return created;
  }

  getMine(userId: string, animeId: string) {
    return (
      this.data.ratings.find((rating) => rating.userId === userId && rating.animeId === animeId) ?? {
        subRating: null,
        dubRating: null,
      }
    );
  }

  remove(userId: string, animeId: string) {
    const index = this.data.ratings.findIndex((rating) => rating.userId === userId && rating.animeId === animeId);
    if (index >= 0) {
      this.data.ratings.splice(index, 1);
    }
    return { message: 'Rating removed' };
  }

  getDistribution(animeId: string) {
    // The detail page only needs simple 1-5 bucket counts, so we keep the shape compact.
    const anime = this.data.findAnimeById(animeId);
    if (!anime) {
      throw new NotFoundException('Anime not found');
    }

    const sub = [0, 0, 0, 0, 0];
    const dub = [0, 0, 0, 0, 0];
    const ratings = this.data.ratings.filter((rating) => rating.animeId === animeId);

    ratings.forEach((rating) => {
      if (rating.subRating) sub[rating.subRating - 1] += 1;
      if (rating.dubRating) dub[rating.dubRating - 1] += 1;
    });

    return {
      sub,
      dub,
      totalVotes: ratings.length,
    };
  }
}
