// CommentsService manages threaded discussion state, ownership checks, and vote totals.
import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../common/prisma/prisma.service';
import { CommentsQueryDto, CreateCommentDto, UpdateCommentDto, VoteCommentDto } from './dto/comments.dto';

const AUTHOR = { select: { id: true, username: true } } as const;

const THREAD_SELECT = {
  id: true,
  content: true,
  createdAt: true,
  updatedAt: true,
  user: AUTHOR,
  replies: {
    orderBy: { createdAt: 'asc' },
    select: { id: true, content: true, createdAt: true, updatedAt: true, user: AUTHOR },
  },
} satisfies Prisma.CommentSelect;

type ThreadRow = Prisma.CommentGetPayload<{ select: typeof THREAD_SELECT }>;

@Injectable()
export class CommentsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(animeId: string, query: CommentsQueryDto) {
    // We paginate top-level comments and always include their replies inline for convenience.
    await this.requireAnime(animeId);

    const { page = 1, limit = 20 } = query;
    const where = { animeId, parentId: null };
    const [total, threads] = await Promise.all([
      this.prisma.comment.count({ where }),
      this.prisma.comment.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
        select: THREAD_SELECT,
      }),
    ]);

    return {
      items: await this.withScores(threads),
      pagination: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) },
    };
  }

  async create(userId: string, animeId: string, dto: CreateCommentDto) {
    // Replies are just comments with parentId set, which keeps the model lightweight.
    await this.requireAnime(animeId);

    if (dto.parentId) {
      const parent = await this.findComment(dto.parentId, animeId);
      if (parent.isDeleted) {
        throw new BadRequestException('You cannot reply to a deleted comment');
      }

      // Threads are one level deep: list() only returns replies to top-level
      // comments, so a reply to a reply would be stored but never shown.
      if (parent.parentId !== null) {
        throw new BadRequestException('Reply to the top-level comment instead of another reply');
      }
    }

    const created = await this.prisma.comment.create({
      data: { id: randomUUID(), userId, animeId, parentId: dto.parentId ?? null, content: dto.content.trim() },
      select: { id: true },
    });
    return this.serializeComment(created.id);
  }

  async update(userId: string, animeId: string, commentId: string, dto: UpdateCommentDto) {
    const comment = await this.findComment(commentId, animeId);
    if (comment.userId !== userId) {
      throw new ForbiddenException('You can only edit your own comments');
    }

    if (comment.isDeleted) {
      throw new BadRequestException('Deleted comments cannot be edited');
    }

    await this.prisma.comment.update({ where: { id: commentId }, data: { content: dto.content } });
    return this.serializeComment(commentId);
  }

  async remove(userId: string, animeId: string, commentId: string) {
    const comment = await this.findComment(commentId, animeId);
    if (comment.userId !== userId) {
      throw new ForbiddenException('You can only delete your own comments');
    }

    await this.prisma.comment.update({ where: { id: commentId }, data: { isDeleted: true, content: '[deleted]' } });
    return { message: 'Comment deleted' };
  }

  async vote(userId: string, animeId: string, commentId: string, dto: VoteCommentDto) {
    // Voting is an upsert so repeated likes/dislikes simply overwrite the prior choice.
    const comment = await this.findComment(commentId, animeId);
    if (comment.isDeleted) {
      throw new BadRequestException('Deleted comments cannot receive votes');
    }

    const existing = await this.prisma.commentLike.findUnique({ where: { commentId_userId: { commentId, userId } } });
    await this.prisma.commentLike.upsert({
      where: { commentId_userId: { commentId, userId } },
      create: { commentId, userId, value: dto.value },
      update: { value: dto.value },
    });
    return { message: existing ? 'Vote updated' : 'Vote recorded' };
  }

  async removeVote(userId: string, animeId: string, commentId: string) {
    await this.findComment(commentId, animeId);
    await this.prisma.commentLike.deleteMany({ where: { commentId, userId } });
    return { message: 'Vote removed' };
  }

  async softDeleteByAdmin(commentId: string) {
    await this.findComment(commentId);
    await this.prisma.comment.update({ where: { id: commentId }, data: { isDeleted: true, content: '[removed by moderator]' } });
  }

  private async serializeComment(commentId: string) {
    const thread = await this.prisma.comment.findUniqueOrThrow({ where: { id: commentId }, select: THREAD_SELECT });
    return (await this.withScores([thread]))[0];
  }

  // The like score is the sum of +1 and -1 votes, summed in one query per page.
  private async withScores(threads: ThreadRow[]) {
    const sums = await this.prisma.commentLike.groupBy({
      by: ['commentId'],
      where: { commentId: { in: threads.map((thread) => thread.id) } },
      _sum: { value: true },
    });
    const scores = new Map(sums.map((entry) => [entry.commentId, entry._sum.value ?? 0]));

    return threads.map((thread) => ({ ...thread, _count: { likes: scores.get(thread.id) ?? 0 } }));
  }

  private async requireAnime(animeId: string) {
    const anime = await this.prisma.anime.findUnique({ where: { id: animeId }, select: { id: true } });
    if (!anime) {
      throw new NotFoundException('Anime not found');
    }
  }

  private async findComment(commentId: string, animeId?: string) {
    const comment = await this.prisma.comment.findUnique({ where: { id: commentId } });
    if (!comment || (animeId && comment.animeId !== animeId)) {
      throw new NotFoundException('Comment not found');
    }
    return comment;
  }
}
