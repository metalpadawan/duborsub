// Dub reports hang under the anime they describe: anyone can read the count, and a
// signed-in viewer can say "this has an English dub" or take that back.
import { Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ParseResourceIdPipe } from '../common/pipes/parse-resource-id.pipe';
import { DubReportsService } from './dub-reports.service';

@Controller('anime/:animeId/dub')
export class DubReportsController {
  constructor(private readonly dubReports: DubReportsService) {}

  @Get()
  state(@Param('animeId', ParseResourceIdPipe) animeId: string) {
    return this.dubReports.getState(animeId, null);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  mine(@Param('animeId', ParseResourceIdPipe) animeId: string, @CurrentUser() user: { id: string }) {
    return this.dubReports.getState(animeId, user.id);
  }

  @Post('reports')
  @UseGuards(JwtAuthGuard)
  report(@Param('animeId', ParseResourceIdPipe) animeId: string, @CurrentUser() user: { id: string }) {
    return this.dubReports.report(animeId, user.id);
  }

  @Delete('reports')
  @UseGuards(JwtAuthGuard)
  withdraw(@Param('animeId', ParseResourceIdPipe) animeId: string, @CurrentUser() user: { id: string }) {
    return this.dubReports.withdraw(animeId, user.id);
  }
}
