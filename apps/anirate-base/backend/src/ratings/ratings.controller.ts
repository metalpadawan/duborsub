// RatingsController hangs rating routes under a specific anime resource.
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ParseResourceIdPipe } from '../common/pipes/parse-resource-id.pipe';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UpsertRatingDto } from './dto/ratings.dto';
import { RatingsService } from './ratings.service';

@Controller('anime/:animeId/ratings')
export class RatingsController {
  constructor(private readonly ratingsService: RatingsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  upsert(
    @Param('animeId', ParseResourceIdPipe) animeId: string,
    @CurrentUser() user: { id: string },
    @Body() dto: UpsertRatingDto,
  ) {
    return this.ratingsService.upsert(user.id, animeId, dto);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  getMine(@Param('animeId', ParseResourceIdPipe) animeId: string, @CurrentUser() user: { id: string }) {
    return this.ratingsService.getMine(user.id, animeId);
  }

  @Delete()
  @UseGuards(JwtAuthGuard)
  remove(@Param('animeId', ParseResourceIdPipe) animeId: string, @CurrentUser() user: { id: string }) {
    return this.ratingsService.remove(user.id, animeId);
  }

  @Get('distribution')
  getDistribution(@Param('animeId', ParseResourceIdPipe) animeId: string) {
    return this.ratingsService.getDistribution(animeId);
  }
}
