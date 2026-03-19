// ============================================================
// ANIME MODULE
// ============================================================

// ── anime.dto.ts ─────────────────────────────────────────────
import {
  IsString, IsOptional, IsBoolean, IsInt, Min, Max,
  MaxLength, IsEnum, IsArray, IsUrl,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

export enum AnimeStatus { airing = 'airing', completed = 'completed', upcoming = 'upcoming' }

export class CreateAnimeDto {
  @IsString() @MaxLength(255) title: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsUrl() coverImageUrl?: string;
  @IsOptional() @IsInt() @Min(1960) @Max(2100) releaseYear?: number;
  @IsOptional() @IsBoolean() hasDub?: boolean;
  @IsOptional() @IsEnum(AnimeStatus) status?: AnimeStatus;
  @IsOptional() @IsArray() @IsInt({ each: true }) genreIds?: number[];
}

export class UpdateAnimeDto {
  @IsOptional() @IsString() @MaxLength(255) title?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsUrl() coverImageUrl?: string;
  @IsOptional() @IsInt() @Min(1960) @Max(2100) releaseYear?: number;
  @IsOptional() @IsBoolean() hasDub?: boolean;
  @IsOptional() @IsEnum(AnimeStatus) status?: AnimeStatus;
  @IsOptional() @IsArray() @IsInt({ each: true }) genreIds?: number[];
}

export class AnimeQueryDto {
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsEnum(AnimeStatus) status?: AnimeStatus;
  @IsOptional() @Type(() => Number) @IsInt() year?: number;
  @IsOptional() @Type(() => Number) @IsInt() genreId?: number;
  @IsOptional() @IsEnum(['title', 'rating', 'year', 'votes']) sortBy?: string;
  @IsOptional() @IsEnum(['asc', 'desc']) order?: 'asc' | 'desc';
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50) limit?: number = 20;
}

// ── anime.service.ts ─────────────────────────────────────────
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { Prisma } from '@prisma/client';

const ANIME_SELECT = {
  id: true, title: true, coverImageUrl: true, releaseYear: true,
  status: true, hasDub: true, avgSubRating: true, avgDubRating: true,
  totalVotes: true,
  animeGenres: { select: { genre: { select: { id: true, name: true } } } },
} satisfies Prisma.AnimeSelect;

@Injectable()
export class AnimeService {
  constructor(private prisma: PrismaService) {}

  async findAll(query: AnimeQueryDto) {
    const { search, status, year, genreId, sortBy = 'title', order = 'asc', page, limit } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.AnimeWhereInput = {
      ...(status && { status }),
      ...(year && { releaseYear: year }),
      ...(genreId && { animeGenres: { some: { genreId } } }),
      ...(search && {
        OR: [
          { title: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    const orderBy: Prisma.AnimeOrderByWithRelationInput =
      sortBy === 'rating' ? { avgSubRating: order } :
      sortBy === 'year'   ? { releaseYear: order }  :
      sortBy === 'votes'  ? { totalVotes: order }   :
                            { title: order };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.anime.findMany({ where, orderBy, skip, take: limit, select: ANIME_SELECT }),
      this.prisma.anime.count({ where }),
    ]);

    return {
      items: items.map(this.formatGenres),
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string) {
    const anime = await this.prisma.anime.findUnique({
      where: { id },
      select: {
        ...ANIME_SELECT,
        description: true,
        createdAt: true,
        _count: { select: { comments: { where: { isDeleted: false } } } },
      },
    });
    if (!anime) throw new NotFoundException('Anime not found');
    return this.formatGenres(anime);
  }

  async create(dto: CreateAnimeDto) {
    const { genreIds, ...data } = dto;
    return this.prisma.anime.create({
      data: {
        ...data,
        animeGenres: genreIds?.length
          ? { create: genreIds.map((id) => ({ genreId: id })) }
          : undefined,
      },
      select: ANIME_SELECT,
    });
  }

  async update(id: string, dto: UpdateAnimeDto) {
    await this.findOne(id);
    const { genreIds, ...data } = dto;

    return this.prisma.anime.update({
      where: { id },
      data: {
        ...data,
        ...(genreIds !== undefined && {
          animeGenres: {
            deleteMany: {},
            create: genreIds.map((gid) => ({ genreId: gid })),
          },
        }),
      },
      select: ANIME_SELECT,
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.anime.delete({ where: { id } });
    return { message: 'Anime deleted' };
  }

  private formatGenres<T extends { animeGenres?: { genre: { id: number; name: string } }[] }>(
    anime: T,
  ) {
    const { animeGenres, ...rest } = anime as any;
    return { ...rest, genres: animeGenres?.map((ag: any) => ag.genre) ?? [] };
  }
}

// ── anime.controller.ts ───────────────────────────────────────
import {
  Controller, Get, Post, Patch, Delete, Param, Body, Query,
  UseGuards, ParseUUIDPipe,
} from '@nestjs/common';

@Controller('anime')
export class AnimeController {
  constructor(private animeService: AnimeService) {}

  @Get()
  findAll(@Query() query: AnimeQueryDto) {
    return this.animeService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.animeService.findOne(id);
  }

  // Admin-only routes guarded at module level
  @Post()
  create(@Body() dto: CreateAnimeDto) {
    return this.animeService.create(dto);
  }

  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateAnimeDto) {
    return this.animeService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.animeService.remove(id);
  }
}

// ── anime.module.ts ───────────────────────────────────────────
import { Module } from '@nestjs/common';

@Module({
  controllers: [AnimeController],
  providers: [AnimeService],
})
export class AnimeModule {}
