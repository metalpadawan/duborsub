// The root module wires together the in-memory data layer and all feature modules
// that make up the current runnable development version of AniRate.
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { DataModule } from './data/data.module';
import { AuthModule } from './auth/auth.module';
import { AnimeModule } from './anime/anime.module';
import { RatingsModule } from './ratings/ratings.module';
import { CommentsModule } from './comments/comments.module';
import { AdminModule } from './admin/admin.module';

@Module({
  controllers: [AppController],
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DataModule,
    AuthModule,
    AnimeModule,
    RatingsModule,
    CommentsModule,
    AdminModule,
  ],
})
export class AppModule {}
