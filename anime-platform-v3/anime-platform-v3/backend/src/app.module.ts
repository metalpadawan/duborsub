// backend/src/app.module.ts — UPDATED with all new modules
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule }    from './common/prisma/prisma.module';
import { CacheModule }     from './cache/cache.module';
import { MailModule }      from './mail/mail.module';
import { SpamModule }      from './spam/spam.module';
import { AuthModule }      from './auth/auth.module';
import { AnimeModule }     from './anime/anime.module';
import { RatingsModule }   from './ratings/ratings.module';
import { CommentsModule }  from './comments/comments.module';
import { AdminModule }     from './admin/admin.module';
import { UsersModule }     from './users/users.module';
import { WatchlistModule } from './watchlist/watchlist.module';
import { UploadModule }    from './upload/upload.module';
import { HealthModule }    from './health/health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),

    // Infrastructure (global)
    PrismaModule,
    CacheModule,
    MailModule,
    SpamModule,

    // Feature modules
    AuthModule,
    AnimeModule,
    RatingsModule,
    CommentsModule,
    AdminModule,
    UsersModule,
    WatchlistModule,
    UploadModule,
    HealthModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}

// ─────────────────────────────────────────────────────────────
// frontend/src/app/page.tsx — Header update
// Add these links to the existing Header component nav:
//
//   <Link href="/watchlist" className="btn-ghost text-sm">My List</Link>
//
// After login, also show user profile link:
//   {user && (
//     <Link href={`/profile/${user.username}`} className="btn-ghost text-sm">
//       {user.username}
//     </Link>
//   )}
// ─────────────────────────────────────────────────────────────
// frontend/src/app/anime/[id]/page.tsx — Add WatchlistButton
// Import and place below the RatingComparison component:
//
//   import WatchlistButton from '@/components/WatchlistButton';
//
//   // Inside the hero section, below RatingComparison:
//   <WatchlistButton animeId={id} />
// ─────────────────────────────────────────────────────────────
// admin/anime/page.tsx — Add CoverUpload to edit modal
// Import and use when editTarget is set:
//
//   import CoverUpload from '@/components/CoverUpload';
//
//   // Inside modal, after the cover URL input:
//   {editTarget && (
//     <CoverUpload
//       animeId={editTarget.id}
//       currentUrl={editTarget.coverImageUrl}
//       onSuccess={(url) => setForm(f => ({ ...f, coverImageUrl: url }))}
//     />
//   )}
