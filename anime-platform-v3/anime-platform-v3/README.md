# AniRate — v3: Recommended Features

Five production-ready features added on top of the base platform.

---

## What's included

### 1 — User profiles (`/profile/[username]`)

**Backend** (`src/users/users.module.ts`)
- `GET /users/:username` — public profile with rating/comment counts
- `GET /users/:username/ratings` — paginated rating history with anime details
- `GET /users/:username/comments` — paginated comment history
- `GET /users/:username/stats` — sub vs dub preference breakdown
- `PATCH /users/me` — update own username (authenticated)

**Frontend** (`src/app/profile/[username]/page.tsx`)
- Avatar generated from username initial with gradient
- Rating history grid (same card style as catalog)
- Recent comments with anime links
- Sub vs Dub preference sidebar:
  - Win/tie breakdown with animated bars
  - Star distribution histograms for sub and dub separately
  - Preference badge (Prefers SUB / Prefers DUB / Balanced viewer)

---

### 2 — Watchlist

**Backend** (`src/watchlist/watchlist.module.ts`)
- 5 statuses: `plan_to_watch`, `watching`, `completed`, `on_hold`, `dropped`
- `GET /watchlist` — full list, optionally filtered by status, grouped by status
- `GET /watchlist/stats` — counts per status
- `POST /watchlist/:animeId` — upsert entry
- `GET /watchlist/:animeId/status` — check single entry
- `DELETE /watchlist/:animeId` — remove entry

**Database migration**: SQL and Prisma schema additions in the module file header.

**Frontend**
- `src/app/watchlist/page.tsx` — full watchlist page with status tabs, grid, and inline status changer
- `src/components/WatchlistButton.tsx` — drop-in button for catalog/detail pages; shows current status, dropdown to change, remove option

**Integration**: Add `<WatchlistButton animeId={id} />` to the anime detail page.

---

### 3 — Redis caching (`src/cache/cache.module.ts`)

Global `CacheService` with:
- `wrap(key, ttl, fn)` — cache-aside pattern, returns cached value or calls fn
- `get / set / del / delPattern` — all fail silently if Redis is unavailable
- Pre-built key builders: `CacheService.keys.animeList(qs)`, `.animeDetail(id)`, `.userProfile(username)`, etc.
- Predefined TTLs: `CacheService.TTL.ANIME_LIST` (5 min), `ANIME_DETAIL` (2 min), etc.

**Integration pattern** (shown in module file):
```ts
// In AnimeService:
async findAll(query) {
  return this.cache.wrap(
    CacheService.keys.animeList(JSON.stringify(query)),
    CacheService.TTL.ANIME_LIST,
    () => this._findAll(query),
  );
}

// Invalidate on mutation:
await this.cache.delPattern('anime:list:*');
await this.cache.del(CacheService.keys.animeDetail(id));
```

**Add to env:**
```env
REDIS_URL=redis://localhost:6379
# Railway: add Redis service, copy the REDIS_URL variable
```

**Railway Redis**: Click + New → Database → Redis in your Railway project. The `REDIS_URL` variable is auto-linked.

---

### 4 — Image upload (`src/upload/upload.module.ts`)

- Works with **Cloudflare R2** (recommended — free 10GB/month) or **AWS S3**
- Uploads 4 variants per image: `sm` (150×225), `md` (300×450), `lg` (600×900), `orig`
- All variants converted to WebP for size efficiency
- `sharp` resizes with `attention` focus point (keeps faces/subjects centered)
- `POST /upload/cover/:animeId` — admin only, updates `anime.coverImageUrl` automatically
- `DELETE /upload/cover/:animeId` — removes all variants from storage

**Frontend**: `src/components/CoverUpload.tsx` — drag-and-drop uploader with immediate preview, upload progress overlay, error feedback.

**Add to env:**
```env
S3_ENDPOINT=https://<account_id>.r2.cloudflarestorage.com
S3_ACCESS_KEY=your_r2_access_key
S3_SECRET_KEY=your_r2_secret_key
S3_BUCKET=anirate-media
CDN_URL=https://cdn.anirate.app
```

**Integration**: In `admin/anime/page.tsx` edit modal, add `<CoverUpload animeId={editTarget.id} ... />`.

---

### 5 — Spam protection (`src/spam/spam.module.ts`)

Three layers:

**Rate limiting**
- 5 comments per 60 seconds per user
- Exceeding → 5-minute block stored in Redis
- Block key survives cache restarts (TTL-based)

**Content analysis** (score-based, non-blocking)
- 3+ URLs in one comment
- 15+ repeated characters
- Spam keyword + link patterns
- 20+ consecutive caps words
- Short comment consisting only of a link
- Score ≥ 3 → auto-flagged for admin review

**Honeypot**
- Hidden `<input name="website">` field in the comment form
- Bots fill it in; humans don't see it
- Filled honeypot → `BadRequestException` (looks like normal validation error)

**Admin flag queue**
- `GET /admin/flagged-comments` — returns recently flagged comments with reasons
- Flags stored in Redis with 24h TTL (non-persistent, for active moderation)

**Integration**:
```ts
// In CommentsService.create():
await this.spam.validateComment(userId, dto.content, dto._hp);
const comment = await this.prisma.comment.create({ ... });
const { score, reasons } = this.spam.analyzeContent(dto.content);
if (score >= 3) await this.spam.autoFlag(comment.id, reasons);
```

---

## New env variables summary

```env
# Redis (required for caching + spam protection)
REDIS_URL=redis://localhost:6379

# Image upload (required for cover art)
S3_ENDPOINT=https://<account>.r2.cloudflarestorage.com
S3_ACCESS_KEY=...
S3_SECRET_KEY=...
S3_BUCKET=anirate-media
CDN_URL=https://cdn.anirate.app
```

## New npm packages to install

```bash
# Backend
npm install ioredis
npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
npm install multer @types/multer
npm install sharp @types/sharp
```

## Files in this package

```
backend/src/
  users/users.module.ts         Profile API (GET profile, ratings, comments, stats)
  watchlist/watchlist.module.ts Watchlist CRUD + status management
  cache/cache.module.ts         Redis CacheService + CacheModule
  upload/upload.module.ts       S3/R2 image upload (4 variants, WebP)
  spam/spam.module.ts           Rate limiting + content analysis + honeypot + flag queue
  app.module.ts                 Updated root module registering all new modules

frontend/src/
  app/profile/[username]/page.tsx   User profile page with stats sidebar
  app/watchlist/page.tsx            My watchlist with status tabs
  components/WatchlistButton.tsx    Drop-in watchlist toggle for any page
  components/CoverUpload.tsx        Drag-and-drop cover uploader (admin)
```
