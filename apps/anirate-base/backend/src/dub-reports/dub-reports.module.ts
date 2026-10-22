// Dub reports are shared by the public endpoints, ratings (a dub rating counts as a
// report) and the admin review queue.
import { Module } from '@nestjs/common';
import { DubReportsController } from './dub-reports.controller';
import { DubReportsService } from './dub-reports.service';

@Module({
  controllers: [DubReportsController],
  providers: [DubReportsService],
  exports: [DubReportsService],
})
export class DubReportsModule {}
