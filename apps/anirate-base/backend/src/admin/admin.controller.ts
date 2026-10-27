// AdminController exposes moderation and analytics routes for authenticated admins.
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { ParseResourceIdPipe } from '../common/pipes/parse-resource-id.pipe';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ResolveTitleRequestDto, TitleRequestQueryDto } from '../title-requests/dto/title-requests.dto';
import { AdminService } from './admin.service';
import { AdminQueryDto, BanUserDto, ChangeRoleDto } from './dto/admin.dto';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('dashboard')
  dashboard() {
    return this.adminService.getDashboardStats();
  }

  @Get('users')
  listUsers(@Query() query: AdminQueryDto) {
    return this.adminService.listUsers(query);
  }

  @Post('users/:id/ban')
  banUser(
    @Param('id', ParseResourceIdPipe) userId: string,
    @CurrentUser() admin: { id: string },
    @Body() dto: BanUserDto,
    @Req() req: Request,
  ) {
    return this.adminService.banUser(admin.id, userId, dto, req.ip ?? '');
  }

  @Post('users/:id/role')
  changeRole(
    @Param('id', ParseResourceIdPipe) userId: string,
    @CurrentUser() admin: { id: string },
    @Body() dto: ChangeRoleDto,
    @Req() req: Request,
  ) {
    return this.adminService.changeRole(admin.id, userId, dto, req.ip ?? '');
  }

  @Post('users/:id/unban')
  unbanUser(
    @Param('id', ParseResourceIdPipe) userId: string,
    @CurrentUser() admin: { id: string },
    @Req() req: Request,
  ) {
    return this.adminService.unbanUser(admin.id, userId, req.ip ?? '');
  }

  @Delete('comments/:id')
  deleteComment(
    @Param('id', ParseUUIDPipe) commentId: string,
    @CurrentUser() admin: { id: string },
    @Req() req: Request,
  ) {
    return this.adminService.deleteComment(admin.id, commentId, req.ip ?? '');
  }

  @Get('dub-reports')
  dubReports() {
    return this.adminService.listDubReports();
  }

  @Post('dub-reports/:animeId/confirm')
  confirmDub(
    @Param('animeId', ParseResourceIdPipe) animeId: string,
    @CurrentUser() admin: { id: string },
    @Req() req: Request,
  ) {
    return this.adminService.confirmDub(admin.id, animeId, req.ip ?? '');
  }

  @Post('dub-reports/:animeId/dismiss')
  dismissDubReports(
    @Param('animeId', ParseResourceIdPipe) animeId: string,
    @CurrentUser() admin: { id: string },
    @Req() req: Request,
  ) {
    return this.adminService.dismissDubReports(admin.id, animeId, req.ip ?? '');
  }

  @Get('title-requests')
  titleRequests(@Query() query: TitleRequestQueryDto) {
    return this.adminService.listTitleRequests(query);
  }

  @Post('title-requests/:id/resolve')
  resolveTitleRequest(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() admin: { id: string },
    @Body() dto: ResolveTitleRequestDto,
    @Req() req: Request,
  ) {
    return this.adminService.resolveTitleRequest(admin.id, id, dto, req.ip ?? '');
  }

  @Get('comment-reports')
  commentReports() {
    return this.adminService.listReportedComments();
  }

  @Post('comment-reports/:commentId/dismiss')
  dismissCommentReports(
    @Param('commentId', ParseUUIDPipe) commentId: string,
    @CurrentUser() admin: { id: string },
    @Req() req: Request,
  ) {
    return this.adminService.dismissCommentReports(admin.id, commentId, req.ip ?? '');
  }

  @Get('comments')
  recentComments(@Query() query: AdminQueryDto) {
    return this.adminService.listRecentComments(query);
  }

  @Get('logs')
  logs(@Query() query: AdminQueryDto) {
    return this.adminService.getAdminLogs(query);
  }
}
