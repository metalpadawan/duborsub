// TitleRequestsService keeps the queue of anime people could not find. Repeat
// requests for the same title are counted, not duplicated, so the queue shows what
// is wanted most; an admin adds the title to the catalogue or rejects the request.
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { AnimeService } from '../anime/anime.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { searchKey } from '../common/search/search-key';
import { CreateTitleRequestDto, ResolveTitleRequestDto, TitleRequestQueryDto } from './dto/title-requests.dto';

@Injectable()
export class TitleRequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly anime: AnimeService,
  ) {}

  async create(dto: CreateTitleRequestDto, userId: string | null) {
    const title = dto.title.trim();
    // Close matches already in the catalogue, in case the visitor searched under another name.
    const possibleMatches = (await this.anime.findAll({ search: title, page: 1, limit: 3 })).items.map((item) => ({
      id: item.id,
      title: item.title,
      releaseYear: item.releaseYear,
      format: item.format,
    }));

    // A bot filled in the hidden field: answer as usual, store nothing.
    if (dto.website) {
      return { status: 'received' as const, possibleMatches };
    }

    const titleKey = searchKey(title) || title.toLowerCase();
    const existing = await this.prisma.titleRequest.findFirst({ where: { titleKey, status: 'pending' }, select: { id: true } });
    if (existing) {
      await this.prisma.titleRequest.update({ where: { id: existing.id }, data: { requestCount: { increment: 1 } } });
      return { status: 'already-requested' as const, possibleMatches };
    }

    await this.prisma.titleRequest.create({
      data: {
        id: randomUUID(),
        title,
        titleKey,
        details: dto.details?.trim() ?? '',
        link: dto.link ?? null,
        userId,
      },
    });
    return { status: 'received' as const, possibleMatches };
  }

  async list(query: TitleRequestQueryDto) {
    const { status = 'pending', page = 1, limit = 20 } = query;
    const where = { status };
    const [total, items] = await Promise.all([
      this.prisma.titleRequest.count({ where }),
      this.prisma.titleRequest.findMany({
        where,
        // Waiting requests: most wanted first. Settled ones: most recent first.
        orderBy: status === 'pending' ? [{ requestCount: 'desc' }, { createdAt: 'asc' }] : [{ resolvedAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          title: true,
          details: true,
          link: true,
          requestCount: true,
          status: true,
          adminNote: true,
          animeId: true,
          createdAt: true,
          resolvedAt: true,
          user: { select: { username: true } },
        },
      }),
    ]);

    return { items, pagination: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) } };
  }

  async resolve(adminId: string, id: string, dto: ResolveTitleRequestDto) {
    const request = await this.prisma.titleRequest.findUnique({ where: { id }, select: { status: true, title: true } });
    if (!request) {
      throw new NotFoundException('Request not found');
    }

    if (request.status !== 'pending') {
      throw new BadRequestException('This request was already settled');
    }

    if (dto.status === 'added' && dto.animeId && !(await this.prisma.anime.findUnique({ where: { id: dto.animeId }, select: { id: true } }))) {
      throw new BadRequestException('That title is not in the catalogue');
    }

    await this.prisma.titleRequest.update({
      where: { id },
      data: {
        status: dto.status,
        animeId: dto.status === 'added' ? (dto.animeId ?? null) : null,
        adminNote: dto.note?.trim() || null,
        resolvedById: adminId,
        resolvedAt: new Date(),
      },
    });
    return { message: dto.status === 'added' ? 'Marked as added' : 'Request rejected', title: request.title };
  }

  countPending() {
    return this.prisma.titleRequest.count({ where: { status: 'pending' } });
  }
}
