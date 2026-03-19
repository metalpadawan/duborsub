import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { DataService } from '../data/data.service';
import { AnimeQueryDto, CreateAnimeDto, UpdateAnimeDto } from './dto/anime.dto';

@Injectable()
export class AnimeService {
  constructor(private readonly data: DataService) {}

  findAll(query: AnimeQueryDto) {
    const {
      search,
      status,
      year,
      genreId,
      sortBy = 'title',
      order = 'asc',
      page = 1,
      limit = 20,
    } = query;

    let items = this.data.anime.map((anime) => this.enrichAnime(anime.id));

    if (search) {
      const needle = search.toLowerCase();
      items = items.filter((anime) => anime.title.toLowerCase().includes(needle));
    }

    if (status) {
      items = items.filter((anime) => anime.status === status);
    }

    if (year) {
      items = items.filter((anime) => anime.releaseYear === year);
    }

    if (genreId) {
      items = items.filter((anime) => anime.genres.some((genre) => genre.id === genreId));
    }

    items.sort((left, right) => {
      if (sortBy === 'rating') {
        const leftValue = left.avgSubRating ?? 0;
        const rightValue = right.avgSubRating ?? 0;
        return order === 'asc' ? leftValue - rightValue : rightValue - leftValue;
      }

      if (sortBy === 'votes') {
        return order === 'asc'
          ? left.totalVotes - right.totalVotes
          : right.totalVotes - left.totalVotes;
      }

      if (sortBy === 'year') {
        const leftValue = left.releaseYear ?? 0;
        const rightValue = right.releaseYear ?? 0;
        return order === 'asc' ? leftValue - rightValue : rightValue - leftValue;
      }

      return order === 'asc'
        ? left.title.localeCompare(right.title)
        : right.title.localeCompare(left.title);
    });

    const total = items.length;
    const start = (page - 1) * limit;
    const paged = items.slice(start, start + limit);

    return {
      items: paged,
      pagination: {
        page,
        limit,
        total,
        pages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  findOne(id: string) {
    return this.enrichAnime(id);
  }

  create(dto: CreateAnimeDto) {
    const now = new Date();
    const anime = {
      id: randomUUID(),
      title: dto.title,
      description: dto.description ?? '',
      coverImageUrl: dto.coverImageUrl ?? null,
      releaseYear: dto.releaseYear ?? null,
      hasDub: dto.hasDub ?? false,
      status: dto.status ?? 'completed',
      genres: this.pickGenres(dto.genreIds),
      createdAt: now,
      updatedAt: now,
    };

    this.data.anime.push(anime);
    return this.enrichAnime(anime.id);
  }

  update(id: string, dto: UpdateAnimeDto) {
    const anime = this.data.findAnimeById(id);
    if (!anime) {
      throw new NotFoundException('Anime not found');
    }

    if (dto.title !== undefined) anime.title = dto.title;
    if (dto.description !== undefined) anime.description = dto.description;
    if (dto.coverImageUrl !== undefined) anime.coverImageUrl = dto.coverImageUrl;
    if (dto.releaseYear !== undefined) anime.releaseYear = dto.releaseYear;
    if (dto.hasDub !== undefined) anime.hasDub = dto.hasDub;
    if (dto.status !== undefined) anime.status = dto.status;
    if (dto.genreIds !== undefined) anime.genres = this.pickGenres(dto.genreIds);
    anime.updatedAt = new Date();

    return this.enrichAnime(id);
  }

  remove(id: string) {
    const index = this.data.anime.findIndex((anime) => anime.id === id);
    if (index === -1) {
      throw new NotFoundException('Anime not found');
    }

    this.data.anime.splice(index, 1);
    this.data.ratings
      .filter((rating) => rating.animeId === id)
      .forEach((rating) => {
        const ratingIndex = this.data.ratings.indexOf(rating);
        if (ratingIndex >= 0) this.data.ratings.splice(ratingIndex, 1);
      });

    return { message: 'Anime deleted' };
  }

  private enrichAnime(id: string) {
    const anime = this.data.findAnimeById(id);
    if (!anime) {
      throw new NotFoundException('Anime not found');
    }

    const ratings = this.data.ratings.filter((entry) => entry.animeId === anime.id);
    const subRatings = ratings
      .map((entry) => entry.subRating)
      .filter((value): value is number => value !== null);
    const dubRatings = ratings
      .map((entry) => entry.dubRating)
      .filter((value): value is number => value !== null);

    return {
      id: anime.id,
      title: anime.title,
      description: anime.description,
      coverImageUrl: anime.coverImageUrl,
      releaseYear: anime.releaseYear,
      hasDub: anime.hasDub,
      status: anime.status,
      avgSubRating: this.average(subRatings),
      avgDubRating: this.average(dubRatings),
      totalVotes: ratings.length,
      genres: anime.genres,
      createdAt: anime.createdAt,
      updatedAt: anime.updatedAt,
    };
  }

  private average(values: number[]) {
    if (values.length === 0) {
      return null;
    }

    const sum = values.reduce((total, value) => total + value, 0);
    return Number((sum / values.length).toFixed(2));
  }

  private pickGenres(genreIds: number[] | undefined) {
    if (!genreIds || genreIds.length === 0) {
      return [];
    }

    const available = this.data.anime.flatMap((anime) => anime.genres);
    return available.filter(
      (genre, index, self) =>
        genreIds.includes(genre.id) && self.findIndex((candidate) => candidate.id === genre.id) === index,
    );
  }
}
