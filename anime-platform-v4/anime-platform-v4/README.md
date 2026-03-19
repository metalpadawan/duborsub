# AniRate — v4: Growth Features

All five growth features. The platform is now feature-complete.

---

## 1 — Recommendation engine

**Algorithm**: User-based collaborative filtering with cosine similarity.

How it works:
1. Load the target user's rating history (sub+dub averaged per anime)
2. Find all other users who have rated at least one of the same anime
3. Compute cosine similarity between rating vectors for each pair
4. Take the top 20 most similar neighbours
5. Collect anime those neighbours rated ≥ 3.5 that the user hasn't seen
6. Weight each anime's score by neighbour similarity, require ≥ 2 neighbours to agree
7. Return top 12 ranked by weighted predicted score

Cold start (< 3 ratings): falls back to popular anime sorted by vote count.

**Endpoints**
- `GET /recommendations/me` — personalised (JWT required)
- `GET /recommendations/popular` — popular fallback (public)
- `GET /recommendations/similar/:animeId` — similar anime by genre + rating overlap

**Frontend components**
- `RecommendationRow` — grid of recommended anime for the homepage
- `SimilarAnime` — related anime grid for the detail page

**Integration**: In `RatingsService.upsert()`, call `recsService.invalidateForUser(userId)` after saving to bust the cache.

---

## 2 — Social follows + activity feed

**Database migration**: SQL and Prisma schema additions in the module file header.

**Endpoints**
- `POST /social/follow/:username` — follow
- `DELETE /social/follow/:username` — unfollow
- `GET /social/follow/:username/status` — am I following this user?
- `GET /social/followers/:username` — who follows them
- `GET /social/following/:username` — who they follow
- `GET /social/feed?cursor=` — cursor-paginated activity feed

The feed merges ratings and comments from followed users, sorted by timestamp, with cursor-based pagination for infinite scroll.

**Frontend**
- `src/app/feed/page.tsx` — infinite scroll feed page
- `FollowButton` component — drops into any profile page
- Add `<FollowButton username={profile.username} />` to `profile/[username]/page.tsx`

---

## 3 — OAuth (Google + Discord)

**Flow**: `GET /auth/google` → Google consent → `GET /auth/google/callback` → issues JWT + refresh cookie → redirects to `/oauth/callback?token=...` → frontend stores token → redirects to `/`

Account linking logic:
1. If OAuth provider+ID already linked → log in as that user
2. If email matches existing account → link and log in
3. Otherwise → create new account with auto-generated unique username

`password_hash` is made nullable so OAuth-only users don't need a password.

**Frontend**
- `OAuthButtons` component — Google + Discord buttons for login/register pages
- `src/app/oauth/callback/page.tsx` — receives token, stores it, redirects home
- Add `<OAuthButtons />` to login and register pages

**Required env vars**
```env
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_CALLBACK_URL=https://your-api.railway.app/api/v1/auth/google/callback

DISCORD_CLIENT_ID=...
DISCORD_CLIENT_SECRET=...
DISCORD_CALLBACK_URL=https://your-api.railway.app/api/v1/auth/discord/callback
```

**Required packages**: `passport-google-oauth20`, `passport-discord`, `@types/passport-google-oauth20`

---

## 4 — Advanced search

PostgreSQL full-text search using the GIN tsvector index already in the schema.

**How it works**: When `q` is provided, builds a `tsquery` with `:*` prefix matching (supports partial words), runs ranked FTS against `title || description`, then hydrates genre data in a second query. Without `q`, uses Prisma's type-safe builder for filter-only queries.

**Filters**: genres (multi-select), min rating, year range, status, has dub
**Sort**: relevance (ts_rank), rating, votes, year, title

**Endpoints**
- `GET /search?q=&genres=1,5&minRating=3&yearFrom=2010&sortBy=relevance` — full search
- `GET /search/suggest?q=naru` — typeahead (8 results, 300s cache)

**Frontend** (`src/app/search/page.tsx`)
- Typeahead dropdown with debounce (200ms)
- Sticky filter sidebar: genre chips, rating slider, year range, status, dub filter
- Paginated results grid
- Add a search icon/link in the site header pointing to `/search`

---

## 5 — Sub vs Dub stats page

**Endpoint**: `GET /stats` — returns all four sections in one cached call (30 min TTL)

Four sections:
- **Global overview**: head-to-head win rates, average ratings, star distribution histograms for sub and dub
- **Genre breakdown**: per-genre sub/dub averages, winner badge, vote counts
- **Top lists**: top rated sub, top rated dub, most controversial (biggest sub/dub gap), best dub upgrade (highest dub−sub improvement)
- **Monthly trends**: rating activity over the last 12 months

**Frontend** (`src/app/stats/page.tsx`)
- Animated head-to-head bar showing sub vs dub win percentages
- Star distribution bars for global averages
- Genre table with winner badges
- Four ranked tables with links to anime pages
- SVG bar chart for monthly trends

Add a "Stats" link to the site header pointing to `/stats`.

---

## New API endpoints summary

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/recommendations/me` | JWT | Personalised recs |
| GET | `/recommendations/popular` | — | Popular fallback |
| GET | `/recommendations/similar/:id` | — | Similar anime |
| POST | `/social/follow/:username` | JWT | Follow |
| DELETE | `/social/follow/:username` | JWT | Unfollow |
| GET | `/social/follow/:username/status` | JWT | Follow status |
| GET | `/social/followers/:username` | — | Follower list |
| GET | `/social/following/:username` | — | Following list |
| GET | `/social/feed` | JWT | Activity feed |
| GET | `/auth/google` | — | OAuth redirect |
| GET | `/auth/google/callback` | — | OAuth callback |
| GET | `/auth/discord` | — | OAuth redirect |
| GET | `/auth/discord/callback` | — | OAuth callback |
| GET | `/search` | — | Full-text search |
| GET | `/search/suggest` | — | Typeahead |
| GET | `/stats` | — | All global stats |
| GET | `/stats/global` | — | Global overview only |
| GET | `/stats/genres` | — | Genre breakdown only |
| GET | `/stats/top` | — | Top lists only |
| GET | `/stats/trends` | — | Monthly trends only |

## New DB migrations needed

Two new tables — SQL in the module file headers:

```sql
-- follows
CREATE TABLE follows ( follower_id UUID, following_id UUID, ... );

-- oauth_accounts
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;
CREATE TABLE oauth_accounts ( id UUID, user_id UUID, provider VARCHAR(20), provider_id TEXT, ... );
```

## New npm packages

```bash
npm install passport-google-oauth20 passport-discord
npm install @types/passport-google-oauth20
```

## Files in this package

```
backend/src/
  recommendations/recommendations.module.ts   Collaborative filter engine
  social/social.module.ts                     Follow system + cursor-paginated feed
  oauth/oauth.module.ts                       Google + Discord Passport strategies
  search/search.module.ts                     FTS search + typeahead
  search/stats.module.ts                      Global sub vs dub statistics
  app.module.ts                               Final root module (all features)

frontend/src/
  app/stats/page.tsx                          Sub vs Dub stats page
  app/search/page.tsx                         Advanced search with filters
  app/feed/page.tsx                           Infinite scroll activity feed
  app/oauth/callback/page.tsx                 OAuth token receiver
  components/OAuthButtons.tsx                 Google + Discord login buttons
  components/FollowButton.tsx                 Follow/unfollow toggle
  components/RecommendationRow.tsx            Homepage recommendation grid
  components/SimilarAnime.tsx                 Detail page similar anime grid
```
