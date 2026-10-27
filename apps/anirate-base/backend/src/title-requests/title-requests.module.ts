import { Module } from '@nestjs/common';
import { AnimeModule } from '../anime/anime.module';
import { TitleRequestsController } from './title-requests.controller';
import { TitleRequestsService } from './title-requests.service';

@Module({
  imports: [AnimeModule],
  controllers: [TitleRequestsController],
  providers: [TitleRequestsService],
  exports: [TitleRequestsService],
})
export class TitleRequestsModule {}
