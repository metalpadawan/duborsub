import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { DataService } from '../data/data.service';
import {
  CommentsQueryDto,
  CreateCommentDto,
  UpdateCommentDto,
  VoteCommentDto,
} from './dto/comments.dto';

@Injectable()
export class CommentsService {
  constructor(private readonly data: DataService) {}

  list(animeId: string, query: CommentsQueryDto) {
    const anime = this.data.findAnimeById(animeId);
    if (!anime) {
      throw new NotFoundException('Anime not found');
    }

    const { page = 1, limit = 20 } = query;
    const allTopLevel = this.data.comments
      .filter((comment) => comment.animeId === animeId && comment.parentId === null)
      .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());

    const total = allTopLevel.length;
    const start = (page - 1) * limit;
    const items = allTopLevel.slice(start, start + limit).map((comment) => this.serializeComment(comment.id));

    return {
      items,
      pagination: {
        page,
        limit,
        total,
        pages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  create(userId: string, animeId: string, dto: CreateCommentDto) {
    const anime = this.data.findAnimeById(animeId);
    if (!anime) {
      throw new NotFoundException('Anime not found');
    }

    const created = {
      id: randomUUID(),
      userId,
      animeId,
      parentId: dto.parentId ?? null,
      content: dto.content.trim(),
      isDeleted: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.data.comments.push(created);
    return this.serializeComment(created.id);
  }

  update(userId: string, commentId: string, dto: UpdateCommentDto) {
    const comment = this.findComment(commentId);
    if (comment.userId !== userId) {
      throw new ForbiddenException('You can only edit your own comments');
    }

    comment.content = dto.content.trim();
    comment.updatedAt = new Date();
    return this.serializeComment(comment.id);
  }

  remove(userId: string, commentId: string) {
    const comment = this.findComment(commentId);
    if (comment.userId !== userId) {
      throw new ForbiddenException('You can only delete your own comments');
    }

    comment.isDeleted = true;
    comment.content = '[deleted]';
    comment.updatedAt = new Date();
    return { message: 'Comment deleted' };
  }

  vote(userId: string, commentId: string, dto: VoteCommentDto) {
    this.findComment(commentId);
    const existing = this.data.commentLikes.find(
      (like) => like.commentId === commentId && like.userId === userId,
    );

    if (existing) {
      existing.value = dto.value;
      return { message: 'Vote updated' };
    }

    this.data.commentLikes.push({
      commentId,
      userId,
      value: dto.value,
      createdAt: new Date(),
    });
    return { message: 'Vote recorded' };
  }

  removeVote(userId: string, commentId: string) {
    const index = this.data.commentLikes.findIndex(
      (like) => like.commentId === commentId && like.userId === userId,
    );
    if (index >= 0) {
      this.data.commentLikes.splice(index, 1);
    }
    return { message: 'Vote removed' };
  }

  softDeleteByAdmin(commentId: string) {
    const comment = this.findComment(commentId);
    comment.isDeleted = true;
    comment.content = '[removed by moderator]';
    comment.updatedAt = new Date();
  }

  private serializeComment(commentId: string) {
    const comment = this.findComment(commentId);
    const user = this.data.findUserById(comment.userId);
    const replies = this.data.comments
      .filter((entry) => entry.parentId === comment.id)
      .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime())
      .map((reply) => {
        const replyUser = this.data.findUserById(reply.userId);
        return {
          id: reply.id,
          content: reply.content,
          createdAt: reply.createdAt,
          updatedAt: reply.updatedAt,
          user: replyUser ? { id: replyUser.id, username: replyUser.username } : null,
        };
      });

    const likeScore = this.data.commentLikes
      .filter((like) => like.commentId === comment.id)
      .reduce((total, like) => total + like.value, 0);

    return {
      id: comment.id,
      content: comment.content,
      createdAt: comment.createdAt,
      updatedAt: comment.updatedAt,
      user: user ? { id: user.id, username: user.username } : null,
      replies,
      _count: { likes: likeScore },
    };
  }

  private findComment(commentId: string) {
    const comment = this.data.comments.find((entry) => entry.id === commentId) ?? null;
    if (!comment) {
      throw new NotFoundException('Comment not found');
    }
    return comment;
  }
}
