// The root module wires together the local file-backed datastore and all feature
// modules that make up the current runnable development version of AniRate.
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AuthModule } from './auth/auth.module';
import { AdminModule } from './admin/admin.module';
import { AnimeModule } from './anime/anime.module';
import { AppThrottlerGuard } from './common/guards/app-throttler.guard';
import { CommentsModule } from './comments/comments.module';
import { validateEnvironment } from './config/environment.validation';
import { DataModule } from './data/data.module';
import { MonitoringModule } from './monitoring/monitoring.module';
import { RatingsModule } from './ratings/ratings.module';

@Module({
  controllers: [AppController],
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnvironment,
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60_000,
        limit: 100,
      },
    ]),
    DataModule,
    MonitoringModule,
    AuthModule,
    AnimeModule,
    RatingsModule,
    CommentsModule,
    AdminModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: AppThrottlerGuard,
    },
  ],
})
export class AppModule {}
