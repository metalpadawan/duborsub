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
import { AdminService } from './admin.service';
import { AdminQueryDto, BanUserDto } from './dto/admin.dto';

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

  @Get('logs')
  logs(@Query() query: AdminQueryDto) {
    return this.adminService.getAdminLogs(query);
  }
}
