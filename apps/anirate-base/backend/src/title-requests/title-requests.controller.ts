// Anyone can send in a title, signed in or not; requests are rate-limited per
// visitor and bot submissions are dropped quietly.
import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { CreateTitleRequestDto } from './dto/title-requests.dto';
import { TitleRequestsService } from './title-requests.service';

@Controller('title-requests')
export class TitleRequestsController {
  constructor(private readonly titleRequests: TitleRequestsService) {}

  @Post()
  @UseGuards(OptionalJwtAuthGuard)
  @Throttle({ default: { limit: 5, ttl: 60 * 60_000 } })
  create(@Body() dto: CreateTitleRequestDto, @CurrentUser() user: { id: string } | null) {
    return this.titleRequests.create(dto, user?.id ?? null);
  }
}
