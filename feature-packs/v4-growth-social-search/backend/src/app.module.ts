// backend/src/app.module.ts — FINAL with all modules
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule }           from './common/prisma/prisma.module';
import { CacheModule }            from './cache/cache.module';
import { MailModule }             from './mail/mail.module';
import { SpamModule }             from './spam/spam.module';
import { AuthModule }             from './auth/auth.module';
import { OAuthModule }            from './oauth/oauth.module';
import { AnimeModule }            from './anime/anime.module';
import { RatingsModule }          from './ratings/ratings.module';
import { CommentsModule }         from './comments/comments.module';
import { AdminModule }            from './admin/admin.module';
import { UsersModule }            from './users/users.module';
import { WatchlistModule }        from './watchlist/watchlist.module';
import { UploadModule }           from './upload/upload.module';
import { RecommendationsModule }  from './recommendations/recommendations.module';
import { SocialModule }           from './social/social.module';
import { SearchModule }           from './search/search.module';
import { StatsModule }            from './search/stats.module';
import { HealthModule }           from './health/health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    PrismaModule, CacheModule, MailModule, SpamModule,
    AuthModule, OAuthModule,
    AnimeModule, RatingsModule, CommentsModule,
    AdminModule, UsersModule, WatchlistModule, UploadModule,
    RecommendationsModule, SocialModule, SearchModule, StatsModule,
    HealthModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
