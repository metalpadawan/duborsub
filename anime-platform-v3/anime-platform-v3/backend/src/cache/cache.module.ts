// ============================================================
// REDIS CACHE MODULE
// Install: npm install ioredis
// ============================================================

// ── cache.service.ts ─────────────────────────────────────────
import { Injectable, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class CacheService implements OnModuleDestroy {
  private readonly logger = new Logger(CacheService.name);
  private client: Redis;

  // Default TTLs in seconds
  static readonly TTL = {
    ANIME_LIST:   300,   // 5 min  — catalog changes infrequently
    ANIME_DETAIL: 120,   // 2 min  — ratings update via trigger
    USER_PROFILE: 300,   // 5 min
    WATCHLIST:    60,    // 1 min  — user-specific, changes often
    STATS:        600,   // 10 min — aggregate stats
    GENRES:       3600,  // 1 hr   — almost never changes
  } as const;

  constructor(private config: ConfigService) {
    const url = config.get<string>('REDIS_URL', 'redis://localhost:6379');
    this.client = new Redis(url, {
      maxRetriesPerRequest: 3,
      lazyConnect: true,
      enableReadyCheck: true,
    });

    this.client.on('error', (err) => {
      // Log but don't crash — app works without cache
      this.logger.warn(`Redis error: ${err.message}`);
    });

    this.client.connect().catch(() => {
      this.logger.warn('Redis unavailable — running without cache');
    });
  }

  async onModuleDestroy() {
    await this.client.quit().catch(() => null);
  }

  // ── Core operations ────────────────────────────────────────
  async get<T>(key: string): Promise<T | null> {
    try {
      const raw = await this.client.get(key);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      return null; // Cache miss on error — degrade gracefully
    }
  }

  async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    try {
      await this.client.set(key, JSON.stringify(value), 'EX', ttlSeconds);
    } catch {
      // Silent — cache write failure is non-fatal
    }
  }

  async del(...keys: string[]): Promise<void> {
    try {
      if (keys.length) await this.client.del(...keys);
    } catch { /* silent */ }
  }

  // Delete all keys matching a pattern (e.g. 'anime:*')
  async delPattern(pattern: string): Promise<void> {
    try {
      const keys = await this.client.keys(pattern);
      if (keys.length) await this.client.del(...keys);
    } catch { /* silent */ }
  }

  // ── Typed key builders ─────────────────────────────────────
  static keys = {
    animeList:   (qs: string)        => `anime:list:${qs}`,
    animeDetail: (id: string)        => `anime:detail:${id}`,
    userProfile: (username: string)  => `user:profile:${username}`,
    userStats:   (username: string)  => `user:stats:${username}`,
    watchlist:   (userId: string)    => `watchlist:${userId}`,
    genres:      ()                  => 'genres:all',
  };

  // ── Wrapped cache-aside helper ─────────────────────────────
  async wrap<T>(
    key: string,
    ttl: number,
    fn: () => Promise<T>,
  ): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) return cached;
    const result = await fn();
    await this.set(key, result, ttl);
    return result;
  }
}

// ── cache.module.ts ───────────────────────────────────────────
import { Module, Global } from '@nestjs/common';

@Global()
@Module({
  providers: [CacheService],
  exports:   [CacheService],
})
export class CacheModule {}

// ── How to integrate into existing services ───────────────────
/*
Inject CacheService and use wrap() for read-through caching:

// In AnimeService:
constructor(
  private prisma: PrismaService,
  private cache: CacheService,  // ← inject
) {}

async findAll(query: AnimeQueryDto) {
  const cacheKey = CacheService.keys.animeList(JSON.stringify(query));
  return this.cache.wrap(cacheKey, CacheService.TTL.ANIME_LIST, () =>
    this._findAll(query),  // move original logic to _findAll()
  );
}

async findOne(id: string) {
  return this.cache.wrap(
    CacheService.keys.animeDetail(id),
    CacheService.TTL.ANIME_DETAIL,
    () => this._findOne(id),
  );
}

// Invalidate on mutation:
async update(id: string, dto: UpdateAnimeDto) {
  const result = await this._update(id, dto);
  await this.cache.del(
    CacheService.keys.animeDetail(id),
    CacheService.keys.animeList('*'),  // or use delPattern('anime:list:*')
  );
  await this.cache.delPattern('anime:list:*');
  return result;
}
*/

// ── Cache invalidation map ─────────────────────────────────────
/*
Event                   →  Keys to invalidate
─────────────────────────────────────────────────────────────────
Rating upsert/delete    →  anime:detail:{id}, anime:list:*
                           user:stats:{username}
Anime create/update     →  anime:detail:{id}, anime:list:*
                           genres:all (if genres changed)
Anime delete            →  anime:detail:{id}, anime:list:*
Watchlist change        →  watchlist:{userId}
User profile update     →  user:profile:{username}
Comment create/delete   →  anime:detail:{id}  (comment count changes)
*/
