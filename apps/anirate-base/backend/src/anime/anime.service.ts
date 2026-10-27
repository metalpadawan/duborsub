// AnimeService centralizes catalog reads and admin mutations for anime records.
// Rating totals are kept on each anime row (see anime-stats.ts), so every list
// order except search relevance is a plain SQL ORDER BY.
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../common/prisma/prisma.service';
import { buildSearchText, searchKey, sortTitleOf } from '../common/search/search-key';
import { AnimeQueryDto, CreateAnimeDto, SitemapQueryDto, UpdateAnimeDto } from './dto/anime.dto';

const LIST_SELECT = {
  id: true,
  title: true,
  description: true,
  coverImageUrl: true,
  releaseYear: true,
  hasDub: true,
  status: true,
  format: true,
  episodes: true,
  popularity: true,
  avgSubRating: true,
  avgDubRating: true,
  totalVotes: true,
  createdAt: true,
  updatedAt: true,
  genres: { select: { genre: { select: { id: true, name: true } } }, orderBy: { genreId: 'asc' } },
} satisfies Prisma.AnimeSelect;

type ListRow = Prisma.AnimeGetPayload<{ select: typeof LIST_SELECT }>;

@Injectable()
export class AnimeService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: AnimeQueryDto) {
    const {
      search,
      status,
      year,
      genreId,
      rated,
      sortBy = search ? 'relevance' : 'title',
      order = sortBy === 'title' ? 'asc' : 'desc',
      page = 1,
      limit = 20,
    } = query;

    const needle = search ? searchKey(search) : '';
    // One or two letters appear inside most titles and are below the trigram
    // index's reach, so a short search matches words that start with them and is
    // ordered by popularity in SQL instead of ranked in the application.
    const shortNeedle = needle.length > 0 && needle.length < 3;
    const where: Prisma.AnimeWhereInput = {
      ...(needle && !shortNeedle ? { searchText: { contains: needle } } : {}),
      ...(shortNeedle ? { OR: [{ searchText: { startsWith: needle } }, { searchText: { contains: ` ${needle}` } }] } : {}),
      ...(status ? { status } : {}),
      ...(year ? { releaseYear: year } : {}),
      ...(genreId ? { genres: { some: { genreId } } } : {}),
      ...(rated ? { totalVotes: { gt: 0 } } : {}),
    };
    const skip = (page - 1) * limit;

    let total: number;
    let rows: ListRow[];
    if (sortBy === 'relevance' && needle && !shortNeedle) {
      ({ total, rows } = await this.findByRelevance(where, needle, skip, limit));
    } else {
      const sqlSort = sortBy === 'relevance' ? 'popular' : sortBy;
      const sqlOrder = sortBy === 'relevance' ? 'desc' : order;
      [total, rows] = await Promise.all([
        this.prisma.anime.count({ where }),
        this.prisma.anime.findMany({ where, orderBy: this.orderBy(sqlSort, sqlOrder), skip, take: limit, select: LIST_SELECT }),
      ]);
    }

    return {
      items: rows.map((row) => this.toListItem(row)),
      pagination: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) },
    };
  }

  async findOne(id: string) {
    const anime = await this.prisma.anime.findUnique({
      where: { id },
      select: { ...LIST_SELECT, alternativeTitles: true, externalIds: true, _count: { select: { dubReports: true } } },
    });
    if (!anime) {
      throw new NotFoundException('Anime not found');
    }

    // The detail view adds the alternative titles and outbound IDs the list leaves out.
    return {
      ...this.toListItem(anime),
      alternativeTitles: anime.alternativeTitles,
      externalIds: anime.externalIds,
      dubReports: anime._count.dubReports,
    };
  }

  async listGenres() {
    return { items: await this.prisma.genre.findMany({ orderBy: { name: 'asc' } }) };
  }

  /** Every title's id and last change, a chunk at a time, for the sitemap. */
  async sitemap(query: SitemapQueryDto) {
    const { page = 1, size = 10000 } = query;
    const [total, items] = await Promise.all([
      this.prisma.anime.count(),
      this.prisma.anime.findMany({ orderBy: { id: 'asc' }, skip: (page - 1) * size, take: size, select: { id: true, updatedAt: true } }),
    ]);
    return { items, total };
  }

  async create(dto: CreateAnimeDto) {
    const genreIds = await this.checkGenres(dto.genreIds);
    const alternativeTitles = cleanNames(dto.title, dto.alternativeTitles);
    const anime = await this.prisma.anime.create({
      data: {
        id: randomUUID(),
        title: dto.title,
        sortTitle: sortTitleOf(dto.title),
        searchText: buildSearchText(dto.title, alternativeTitles),
        alternativeTitles,
        format: dto.format ?? null,
        episodes: dto.episodes ?? null,
        description: dto.description ?? '',
        coverImageUrl: dto.coverImageUrl ?? null,
        releaseYear: dto.releaseYear ?? null,
        hasDub: dto.hasDub ?? false,
        status: dto.status ?? 'completed',
        genres: { create: genreIds.map((genreId) => ({ genreId })) },
      },
      select: { id: true },
    });

    return this.findOne(anime.id);
  }

  async update(id: string, dto: UpdateAnimeDto) {
    // Partial updates only touch fields present in the payload.
    const existing = await this.prisma.anime.findUnique({ where: { id }, select: { alternativeTitles: true } });
    if (!existing) {
      throw new NotFoundException('Anime not found');
    }

    const genreIds = dto.genreIds === undefined ? undefined : await this.checkGenres(dto.genreIds);
    const current = await this.prisma.anime.findUniqueOrThrow({ where: { id }, select: { title: true } });
    const title = dto.title ?? current.title;
    const alternativeTitles = dto.alternativeTitles === undefined ? existing.alternativeTitles : cleanNames(title, dto.alternativeTitles);
    const namesChanged = dto.title !== undefined || dto.alternativeTitles !== undefined;
    await this.prisma.$transaction(async (tx) => {
      await tx.anime.update({
        where: { id },
        data: {
          ...(namesChanged
            ? { title, alternativeTitles, sortTitle: sortTitleOf(title), searchText: buildSearchText(title, alternativeTitles) }
            : {}),
          ...(dto.format !== undefined ? { format: dto.format } : {}),
          ...(dto.episodes !== undefined ? { episodes: dto.episodes } : {}),
          ...(dto.description !== undefined ? { description: dto.description } : {}),
          ...(dto.coverImageUrl !== undefined ? { coverImageUrl: dto.coverImageUrl } : {}),
          ...(dto.releaseYear !== undefined ? { releaseYear: dto.releaseYear } : {}),
          ...(dto.hasDub !== undefined ? { hasDub: dto.hasDub } : {}),
          ...(dto.status !== undefined ? { status: dto.status } : {}),
        },
      });

      if (genreIds !== undefined) {
        await tx.animeGenre.deleteMany({ where: { animeId: id } });
        await tx.animeGenre.createMany({ data: genreIds.map((genreId) => ({ animeId: id, genreId })) });
      }

      // A confirmed dub settles any open reports asking for one.
      if (dto.hasDub === true) {
        await tx.dubReport.deleteMany({ where: { animeId: id } });
      }
    });

    return this.findOne(id);
  }

  async remove(id: string) {
    // Ratings, notes, note votes, dub reports and genre links cascade with the anime.
    const { count } = await this.prisma.anime.deleteMany({ where: { id } });
    if (count === 0) {
      throw new NotFoundException('Anime not found');
    }

    return { message: 'Anime deleted' };
  }

  // Search ranks in the application: every match's names are compared with the
  // search, which SQL cannot order by cheaply. The trigram index keeps the match set
  // small, and the names come already folded in search_text, so only a few short
  // columns are read before the page itself is loaded.
  private async findByRelevance(where: Prisma.AnimeWhereInput, needle: string, skip: number, take: number) {
    const matches = await this.prisma.anime.findMany({
      where,
      select: { id: true, title: true, sortTitle: true, searchText: true, totalVotes: true, popularity: true },
    });

    const ranked = matches
      .map((anime) => ({ anime, tier: this.matchTier(anime.title, anime.searchText, needle) }))
      .sort(
        (left, right) =>
          left.tier - right.tier ||
          (right.anime.popularity ?? -1) - (left.anime.popularity ?? -1) ||
          right.anime.totalVotes - left.anime.totalVotes ||
          // Among equal matches the shorter title is usually the main series rather
          // than one of its arcs, films or specials.
          left.anime.title.length - right.anime.title.length ||
          left.anime.sortTitle.localeCompare(right.anime.sortTitle),
      );

    const pageIds = ranked.slice(skip, skip + take).map((entry) => entry.anime.id);
    const pageRows = await this.prisma.anime.findMany({ where: { id: { in: pageIds } }, select: LIST_SELECT });
    const byId = new Map(pageRows.map((row) => [row.id, row]));

    return { total: matches.length, rows: pageIds.map((id) => byId.get(id)).filter((row): row is ListRow => Boolean(row)) };
  }

  // Lower is better. An exact title wins outright; an exact alternative title ranks
  // with a title that starts with the search, and so on down. Within a tier the more
  // popular work comes first, so a parody listing "Attack on Titan" among its names
  // falls below the real seasons.
  private matchTier(title: string, searchText: string, needle: string) {
    const score = (key: string) =>
      key === needle ? 0 : key.startsWith(needle) ? 1 : ` ${key} `.includes(` ${needle} `) ? 2 : key.includes(needle) ? 3 : 9;

    const titleKey = searchKey(title);
    const alternativeKeys = searchText.split(' | ').filter((key) => key !== titleKey);
    return Math.min(score(titleKey), Math.min(9, ...alternativeKeys.map(score)) + 1);
  }

  // Every order ends on the A-Z title, so ties are stable from page to page.
  private orderBy(sortBy: string, order: 'asc' | 'desc'): Prisma.AnimeOrderByWithRelationInput[] {
    const byTitle: Prisma.AnimeOrderByWithRelationInput[] = [{ sortTitle: 'asc' }, { id: 'asc' }];

    switch (sortBy) {
      case 'popular':
        // Titles with no popularity figure go last; AniRate's own votes break ties.
        return [{ popularity: { sort: order, nulls: 'last' } }, { totalVotes: 'desc' }, ...byTitle];
      case 'rating':
        // A title ranks by its better version: how good it is watched the right way.
        return [{ bestRating: { sort: order, nulls: 'last' } }, { totalVotes: 'desc' }, ...byTitle];
      case 'votes':
        return [{ totalVotes: order }, ...byTitle];
      case 'year':
        // Titles with no known year go last whichever way the list runs.
        return [{ releaseYear: { sort: order, nulls: 'last' } }, ...byTitle];
      default:
        return order === 'desc' ? [{ sortTitle: 'desc' }, { id: 'desc' }] : byTitle;
    }
  }

  private toListItem(row: ListRow) {
    return {
      id: row.id,
      title: row.title,
      description: row.description,
      coverImageUrl: row.coverImageUrl,
      releaseYear: row.releaseYear,
      hasDub: row.hasDub,
      status: row.status,
      format: row.format,
      episodes: row.episodes,
      popularity: row.popularity,
      avgSubRating: row.avgSubRating,
      avgDubRating: row.avgDubRating,
      totalVotes: row.totalVotes,
      genres: row.genres.map((entry) => entry.genre),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private async checkGenres(genreIds: number[] | undefined) {
    if (!genreIds || genreIds.length === 0) {
      return [];
    }

    // Genres come from the canonical genre list, so a genre with no titles yet can
    // still be assigned, and an unknown id is an error rather than silently dropped.
    const known = new Set(
      (await this.prisma.genre.findMany({ where: { id: { in: genreIds } }, select: { id: true } })).map((genre) => genre.id),
    );
    const unknown = genreIds.filter((genreId) => !known.has(genreId));
    if (unknown.length) {
      throw new BadRequestException(`Unknown genre id(s): ${unknown.join(', ')}`);
    }

    return genreIds;
  }
}

// Other names as typed by an admin: trimmed, de-duplicated, never repeating the title.
function cleanNames(title: string, names: string[] | undefined) {
  const seen = new Set([title.trim().toLowerCase()]);
  const result: string[] = [];
  for (const name of names ?? []) {
    const value = name.trim();
    if (value && !seen.has(value.toLowerCase())) {
      seen.add(value.toLowerCase());
      result.push(value);
    }
  }
  return result;
}
