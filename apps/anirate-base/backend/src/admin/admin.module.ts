import { Module } from '@nestjs/common';
import { CommentsModule } from '../comments/comments.module';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

@Module({
  imports: [CommentsModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
