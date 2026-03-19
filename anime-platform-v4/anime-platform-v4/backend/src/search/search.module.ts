// ============================================================
// ADVANCED SEARCH MODULE — PostgreSQL full-text search
// Uses the GIN tsvector index already created in schema.sql
// ============================================================

// ── search.dto.ts ─────────────────────────────────────────────
import { IsOptional, IsString, IsInt, IsArray, Min, Max, IsEnum } from 'class-validator';
import { Type, Transform } from 'class-transformer';

export class SearchDto {
  @IsOptional() @IsString() q?: string;

  @IsOptional()
  @Transform(({ value }) => Array.isArray(value) ? value.map(Number) : [Number(value)])
  @IsArray() @IsInt({ each: true })
  genres?: number[];

  @IsOptional() @Type(() => Number) @IsInt() @Min(1960) @Max(2100) yearFrom?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1960) @Max(2100) yearTo?: number;

  @IsOptional() @Type(() => Number) @Min(1) @Max(5) minRating?: number;
  @IsOptional() @Type(() => Number) @Min(1) @Max(5) maxRating?: number;

  @IsOptional() @IsEnum(['airing', 'completed', 'upcoming']) status?: string;
  @IsOptional() @IsEnum(['true', 'false']) hasDub?: string;

  @IsOptional() @IsEnum(['relevance', 'rating', 'votes', 'year', 'title']) sortBy?: string = 'relevance';
  @IsOptional() @IsEnum(['asc', 'desc']) order?: string = 'desc';

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50) limit?: number = 20;
}

// ── search.service.ts ─────────────────────────────────────────
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { CacheService } from '../cache/cache.module';

@Injectable()
export class SearchService {
  constructor(
    private prisma: PrismaService,
    private cache: CacheService,
  ) {}

  async search(dto: SearchDto) {
    const cacheKey = `search:${JSON.stringify(dto)}`;
    return this.cache.wrap(cacheKey, 120, () => this.execute(dto));
  }

  async getSuggestions(q: string) {
    if (!q || q.length < 2) return [];
    return this.cache.wrap(`suggest:${q.toLowerCase()}`, 300, () =>
      this.prisma.anime.findMany({
        where: { title: { contains: q, mode: 'insensitive' } },
        select: { id: true, title: true, coverImageUrl: true, releaseYear: true },
        orderBy: { totalVotes: 'desc' },
        take: 8,
      }),
    );
  }

  private async execute(dto: SearchDto) {
    const {
      q, genres, yearFrom, yearTo, minRating, maxRating,
      status, hasDub, sortBy, order, page = 1, limit = 20,
    } = dto;

    const skip = (page - 1) * limit;
    const hasQuery = q && q.trim().length > 0;

    // Build the WHERE clause using raw SQL when FTS is involved,
    // otherwise fall back to Prisma's type-safe builder
    if (hasQuery) {
      return this.ftsSearch(dto);
    }

    // ── Filter-only (no text query) — use Prisma builder ────
    const where: any = {
      ...(status    && { status }),
      ...(hasDub !== undefined && { hasDub: hasDub === 'true' }),
      ...(yearFrom  && { releaseYear: { gte: yearFrom } }),
      ...(yearTo    && { releaseYear: { ...(yearFrom ? { gte: yearFrom } : {}), lte: yearTo } }),
      ...(minRating && { avgSubRating: { gte: minRating } }),
      ...(maxRating && { avgSubRating: { lte: maxRating } }),
      ...(genres?.length && { animeGenres: { some: { genreId: { in: genres } } } }),
    };

    const orderBy = this.buildOrderBy(sortBy, order);

    const [items, total] = await this.prisma.$transaction([
      this.prisma.anime.findMany({
        where, orderBy, skip, take: limit,
        select: this.animeSelect(),
      }),
      this.prisma.anime.count({ where }),
    ]);

    return {
      items: items.map(this.formatAnime),
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      query: { q, genres, yearFrom, yearTo, minRating, maxRating, status, hasDub },
    };
  }

  // ── Full-text search via raw SQL ──────────────────────────
  private async ftsSearch(dto: SearchDto) {
    const {
      q, genres, yearFrom, yearTo, minRating, maxRating,
      status, hasDub, sortBy = 'relevance', order = 'desc',
      page = 1, limit = 20,
    } = dto;

    const skip = (page - 1) * limit;
    // Sanitise query: strip special chars, add :* prefix match for partial words
    const tsQuery = q!.trim()
      .replace(/[^a-zA-Z0-9 ]/g, ' ')
      .split(/\s+/)
      .filter(Boolean)
      .map(w => `${w}:*`)
      .join(' & ');

    // Build dynamic WHERE conditions
    const conditions: string[] = [
      `to_tsvector('english', coalesce(a.title,'') || ' ' || coalesce(a.description,'')) @@ to_tsquery('english', $1)`,
    ];
    const params: any[] = [tsQuery];
    let idx = 2;

    if (status)          { conditions.push(`a.status = $${idx++}`); params.push(status); }
    if (hasDub !== undefined) { conditions.push(`a.has_dub = $${idx++}`); params.push(hasDub === 'true'); }
    if (yearFrom)        { conditions.push(`a.release_year >= $${idx++}`); params.push(yearFrom); }
    if (yearTo)          { conditions.push(`a.release_year <= $${idx++}`); params.push(yearTo); }
    if (minRating)       { conditions.push(`a.avg_sub_rating >= $${idx++}`); params.push(minRating); }
    if (maxRating)       { conditions.push(`a.avg_sub_rating <= $${idx++}`); params.push(maxRating); }
    if (genres?.length)  {
      conditions.push(`EXISTS (SELECT 1 FROM anime_genres ag WHERE ag.anime_id = a.id AND ag.genre_id = ANY($${idx++}::int[]))`);
      params.push(genres);
    }

    const whereClause = conditions.join(' AND ');
    const orderClause = sortBy === 'relevance'
      ? `ts_rank(to_tsvector('english', coalesce(a.title,'') || ' ' || coalesce(a.description,'')), to_tsquery('english', $1)) DESC`
      : sortBy === 'rating' ? `a.avg_sub_rating ${order.toUpperCase()} NULLS LAST`
      : sortBy === 'votes'  ? `a.total_votes ${order.toUpperCase()}`
      : sortBy === 'year'   ? `a.release_year ${order.toUpperCase()} NULLS LAST`
      : `a.title ${order.toUpperCase()}`;

    const [rows, countResult]: any = await this.prisma.$transaction([
      this.prisma.$queryRawUnsafe(
        `SELECT a.id, a.title, a.cover_image_url, a.release_year, a.status,
                a.has_dub, a.avg_sub_rating, a.avg_dub_rating, a.total_votes,
                ts_rank(to_tsvector('english', coalesce(a.title,'') || ' ' || coalesce(a.description,'')),
                        to_tsquery('english', $1)) AS rank
         FROM anime a
         WHERE ${whereClause}
         ORDER BY ${orderClause}
         LIMIT $${idx++} OFFSET $${idx++}`,
        ...params, limit, skip,
      ),
      this.prisma.$queryRawUnsafe(
        `SELECT COUNT(*)::int AS total FROM anime a WHERE ${whereClause}`,
        ...params,
      ),
    ]);

    // Hydrate genres
    const ids = (rows as any[]).map((r: any) => r.id);
    const genreRows = ids.length ? await this.prisma.animeGenre.findMany({
      where: { animeId: { in: ids } },
      include: { genre: true },
    }) : [];
    const genreMap = new Map<string, any[]>();
    for (const g of genreRows) {
      if (!genreMap.has(g.animeId)) genreMap.set(g.animeId, []);
      genreMap.get(g.animeId)!.push(g.genre);
    }

    const total = (countResult as any[])[0]?.total ?? 0;
    const items = (rows as any[]).map((r: any) => ({
      ...r,
      coverImageUrl: r.cover_image_url,
      releaseYear:   r.release_year,
      avgSubRating:  r.avg_sub_rating,
      avgDubRating:  r.avg_dub_rating,
      totalVotes:    r.total_votes,
      hasDub:        r.has_dub,
      genres: genreMap.get(r.id) ?? [],
      rank: r.rank,
      // Remove snake_case duplicates
      cover_image_url: undefined, release_year: undefined,
      avg_sub_rating: undefined, avg_dub_rating: undefined,
      total_votes: undefined, has_dub: undefined,
    }));

    return {
      items,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      query: { q, genres, yearFrom, yearTo, minRating, maxRating, status, hasDub },
    };
  }

  private buildOrderBy(sortBy = 'title', order = 'desc') {
    const dir = order === 'asc' ? 'asc' as const : 'desc' as const;
    switch (sortBy) {
      case 'rating': return { avgSubRating: dir };
      case 'votes':  return { totalVotes: dir };
      case 'year':   return { releaseYear: dir };
      default:       return { title: 'asc' as const };
    }
  }

  private animeSelect() {
    return {
      id: true, title: true, coverImageUrl: true, releaseYear: true,
      status: true, hasDub: true, avgSubRating: true, avgDubRating: true,
      totalVotes: true,
      animeGenres: { select: { genre: { select: { id: true, name: true } } } },
    };
  }

  private formatAnime(a: any) {
    const { animeGenres, ...rest } = a;
    return { ...rest, genres: animeGenres?.map((ag: any) => ag.genre) ?? [] };
  }
}

// ── search.controller.ts ──────────────────────────────────────
import { Controller, Get, Query } from '@nestjs/common';

@Controller('search')
export class SearchController {
  constructor(private searchService: SearchService) {}

  @Get()
  search(@Query() dto: SearchDto) {
    return this.searchService.search(dto);
  }

  @Get('suggest')
  suggest(@Query('q') q: string) {
    return this.searchService.getSuggestions(q);
  }
}

// ── search.module.ts ──────────────────────────────────────────
import { Module } from '@nestjs/common';

@Module({
  controllers: [SearchController],
  providers: [SearchService],
})
export class SearchModule {}
