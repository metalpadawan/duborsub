import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  CommentsQueryDto,
  CreateCommentDto,
  UpdateCommentDto,
  VoteCommentDto,
} from './dto/comments.dto';
import { CommentsService } from './comments.service';

@Controller('anime/:animeId/comments')
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  @Get()
  list(@Param('animeId', ParseUUIDPipe) animeId: string, @Query() query: CommentsQueryDto) {
    return this.commentsService.list(animeId, query);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  create(
    @Param('animeId', ParseUUIDPipe) animeId: string,
    @CurrentUser() user: { id: string },
    @Body() dto: CreateCommentDto,
  ) {
    return this.commentsService.create(user.id, animeId, dto);
  }

  @Patch(':commentId')
  @UseGuards(JwtAuthGuard)
  update(
    @Param('commentId', ParseUUIDPipe) commentId: string,
    @CurrentUser() user: { id: string },
    @Body() dto: UpdateCommentDto,
  ) {
    return this.commentsService.update(user.id, commentId, dto);
  }

  @Delete(':commentId')
  @UseGuards(JwtAuthGuard)
  remove(@Param('commentId', ParseUUIDPipe) commentId: string, @CurrentUser() user: { id: string }) {
    return this.commentsService.remove(user.id, commentId);
  }

  @Post(':commentId/like')
  @UseGuards(JwtAuthGuard)
  like(
    @Param('commentId', ParseUUIDPipe) commentId: string,
    @CurrentUser() user: { id: string },
    @Body() dto: VoteCommentDto,
  ) {
    return this.commentsService.vote(user.id, commentId, dto);
  }

  @Delete(':commentId/like')
  @UseGuards(JwtAuthGuard)
  unlike(@Param('commentId', ParseUUIDPipe) commentId: string, @CurrentUser() user: { id: string }) {
    return this.commentsService.removeVote(user.id, commentId);
  }
}
