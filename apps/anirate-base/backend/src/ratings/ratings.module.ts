// The ratings module keeps score endpoints isolated from the broader anime module.
import { Module } from '@nestjs/common';
import { DubReportsModule } from '../dub-reports/dub-reports.module';
import { MyRatingsController, RatingsController } from './ratings.controller';
import { RatingsService } from './ratings.service';

@Module({
  imports: [DubReportsModule],
  controllers: [RatingsController, MyRatingsController],
  providers: [RatingsService],
  exports: [RatingsService],
})
export class RatingsModule {}
