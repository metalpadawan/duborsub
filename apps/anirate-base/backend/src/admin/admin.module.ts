// The admin module depends on comments so moderators can reuse comment deletion behavior.
import { Module } from '@nestjs/common';
import { CommentsModule } from '../comments/comments.module';
import { DubReportsModule } from '../dub-reports/dub-reports.module';
import { TitleRequestsModule } from '../title-requests/title-requests.module';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

@Module({
  imports: [CommentsModule, DubReportsModule, TitleRequestsModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
