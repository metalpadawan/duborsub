// ============================================================
// COMMENTS MODULE
// ============================================================

// ── comments.dto.ts ───────────────────────────────────────────
import { IsString, IsOptional, IsUUID, MinLength, MaxLength, IsIn, IsInt } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateCommentDto {
  @IsString() @MinLength(1) @MaxLength(2000) content: string;
  @IsOptional() @IsUUID() parentId?: string;
}

export class UpdateCommentDto {
  @IsString() @MinLength(1) @MaxLength(2000) content: string;
}

export class CommentQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() page?: number = 1;
  @IsOptional() @Type(() => Number) @IsInt() limit?: number = 20;
}

export class LikeCommentDto {
  @IsIn([1, -1]) value: 1 | -1;
}

// ── comments.service.ts ───────────────────────────────────────
import {
  Injectable, NotFoundException, ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

@Injectable()
export class CommentsService {
  constructor(private prisma: PrismaService) {}

  async findByAnime(animeId: string, query: CommentQueryDto) {
    const { page, limit } = query;
    const skip = (page - 1) * limit;

    const [items, total] = await this.prisma.$transaction([
      this.prisma.comment.findMany({
        where: { animeId, parentId: null, isDeleted: false },
        orderBy: { createdAt: 'desc' },
        skip, take: limit,
        include: {
          user: { select: { id: true, username: true } },
          _count: { select: { likes: true, replies: { where: { isDeleted: false } } } },
          replies: {
            where: { isDeleted: false },
            take: 3,
            orderBy: { createdAt: 'asc' },
            include: { user: { select: { id: true, username: true } } },
          },
        },
      }),
      this.prisma.comment.count({ where: { animeId, parentId: null, isDeleted: false } }),
    ]);

    return {
      items,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    };
  }

  async create(userId: string, animeId: string, dto: CreateCommentDto) {
    const anime = await this.prisma.anime.findUnique({ where: { id: animeId } });
    if (!anime) throw new NotFoundException('Anime not found');

    if (dto.parentId) {
      const parent = await this.prisma.comment.findUnique({ where: { id: dto.parentId } });
      if (!parent || parent.isDeleted) throw new NotFoundException('Parent comment not found');
      if (parent.animeId !== animeId) throw new ForbiddenException('Comment mismatch');
    }

    return this.prisma.comment.create({
      data: { userId, animeId, parentId: dto.parentId, content: dto.content },
      include: { user: { select: { id: true, username: true } } },
    });
  }

  async update(userId: string, commentId: string, dto: UpdateCommentDto) {
    const comment = await this.getOwnComment(userId, commentId);
    return this.prisma.comment.update({
      where: { id: comment.id },
      data: { content: dto.content },
    });
  }

  async remove(userId: string, commentId: string, isAdmin = false) {
    const comment = await this.prisma.comment.findUnique({ where: { id: commentId } });
    if (!comment || comment.isDeleted) throw new NotFoundException('Comment not found');

    if (!isAdmin && comment.userId !== userId) {
      throw new ForbiddenException('Cannot delete another user\'s comment');
    }

    // Soft delete
    await this.prisma.comment.update({
      where: { id: commentId },
      data: { isDeleted: true, content: '[deleted]' },
    });
    return { message: 'Comment deleted' };
  }

  async like(userId: string, commentId: string, dto: LikeCommentDto) {
    const comment = await this.prisma.comment.findUnique({ where: { id: commentId } });
    if (!comment || comment.isDeleted) throw new NotFoundException('Comment not found');

    await this.prisma.commentLike.upsert({
      where: { commentId_userId: { commentId, userId } },
      update: { value: dto.value },
      create: { commentId, userId, value: dto.value },
    });

    const score = await this.prisma.commentLike.aggregate({
      where: { commentId },
      _sum: { value: true },
    });

    return { score: score._sum.value ?? 0 };
  }

  async unlike(userId: string, commentId: string) {
    await this.prisma.commentLike.deleteMany({
      where: { commentId, userId },
    });
    return { message: 'Vote removed' };
  }

  private async getOwnComment(userId: string, commentId: string) {
    const comment = await this.prisma.comment.findUnique({ where: { id: commentId } });
    if (!comment || comment.isDeleted) throw new NotFoundException('Comment not found');
    if (comment.userId !== userId) throw new ForbiddenException('Not your comment');
    return comment;
  }
}

// ── comments.controller.ts ────────────────────────────────────
import {
  Controller, Get, Post, Patch, Delete, Param, Body,
  Query, UseGuards, ParseUUIDPipe, HttpCode, HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/strategies/jwt.strategy';
import { CurrentUser } from '../auth/strategies/jwt.strategy';

@Controller('anime/:animeId/comments')
export class CommentsController {
  constructor(private commentsService: CommentsService) {}

  @Get()
  findAll(
    @Param('animeId', ParseUUIDPipe) animeId: string,
    @Query() query: CommentQueryDto,
  ) {
    return this.commentsService.findByAnime(animeId, query);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  create(
    @Param('animeId', ParseUUIDPipe) animeId: string,
    @Body() dto: CreateCommentDto,
    @CurrentUser() user: any,
  ) {
    return this.commentsService.create(user.id, animeId, dto);
  }

  @Patch(':commentId')
  @UseGuards(JwtAuthGuard)
  update(
    @Param('commentId', ParseUUIDPipe) commentId: string,
    @Body() dto: UpdateCommentDto,
    @CurrentUser() user: any,
  ) {
    return this.commentsService.update(user.id, commentId, dto);
  }

  @Delete(':commentId')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Param('commentId', ParseUUIDPipe) commentId: string,
    @CurrentUser() user: any,
  ) {
    return this.commentsService.remove(user.id, commentId);
  }

  @Post(':commentId/like')
  @UseGuards(JwtAuthGuard)
  like(
    @Param('commentId', ParseUUIDPipe) commentId: string,
    @Body() dto: LikeCommentDto,
    @CurrentUser() user: any,
  ) {
    return this.commentsService.like(user.id, commentId, dto);
  }

  @Delete(':commentId/like')
  @UseGuards(JwtAuthGuard)
  unlike(
    @Param('commentId', ParseUUIDPipe) commentId: string,
    @CurrentUser() user: any,
  ) {
    return this.commentsService.unlike(user.id, commentId);
  }
}

// ── comments.module.ts ────────────────────────────────────────
import { Module } from '@nestjs/common';

@Module({
  controllers: [CommentsController],
  providers: [CommentsService],
})
export class CommentsModule {}
