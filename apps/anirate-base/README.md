# AniRate — Anime Sub vs Dub Rating Platform

Full-stack web app for community-driven anime ratings comparing sub and dub versions.

> Repository note: this base app now lives in `apps/anirate-base`. The canonical SQL schema referenced below lives at `../../database/schema.sql`.
>
> Local startup note: the reconstructed development version now boots with seeded in-memory data, so PostgreSQL is preserved for future wiring but is not required just to run the app locally.

**Stack**: Next.js 14 · NestJS · PostgreSQL · Prisma · Tailwind CSS

---

## Project Structure

```
apps/anirate-base/
├── prisma/
│   └── schema.prisma          # Shared Prisma schema
├── backend/                   # NestJS API
│   ├── src/
│   │   ├── main.ts
│   │   ├── app.module.ts
│   │   ├── auth/              # JWT auth, refresh tokens, password reset
│   │   ├── anime/             # Anime CRUD + search
│   │   ├── ratings/           # Sub/Dub ratings (upsert)
│   │   ├── comments/          # Comments + nested replies + likes
│   │   ├── admin/             # User management, moderation, analytics
│   │   └── common/prisma/     # Prisma service
│   └── .env.example
├── frontend/                  # Next.js 14 App Router
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx       # Anime catalog grid
│   │   │   ├── anime/[id]/    # Anime detail + rating + comments
│   │   │   ├── login/         # Auth pages
│   │   │   └── register/
│   │   └── lib/
│   │       ├── api.ts         # Axios client + typed helpers
│   │       └── auth.store.ts  # Zustand auth state
│   └── .env.local.example
└── schema.sql                 # Raw PostgreSQL schema (reference)
```

---

## Quick Start

### Prerequisites
- Node.js 20+
- PostgreSQL 15+
- pnpm (recommended) or npm

### 1 — Database

```bash
# Create the database
createdb anime_platform

# Run the SQL schema (creates tables, triggers, views)
psql anime_platform < ../../database/schema.sql
```

### 2 — Backend

```bash
cd backend
cp .env.example .env
# Edit .env — set DATABASE_URL and JWT_SECRET

npm install
npx prisma generate       # generate Prisma client
npm run start:dev         # runs on http://localhost:4000
```

### 3 — Frontend

```bash
cd frontend
cp .env.local.example .env.local

npm install
npm run dev               # runs on http://localhost:3000
```

---

## API Reference

### Auth
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/auth/register` | — | Create account |
| POST | `/auth/login` | — | Login, returns access token + sets refresh cookie |
| POST | `/auth/refresh` | cookie | Rotate refresh token |
| POST | `/auth/logout` | cookie | Revoke refresh token |
| GET  | `/auth/me` | JWT | Current user |
| POST | `/auth/forgot-password` | — | Send reset email |
| POST | `/auth/reset-password` | — | Use reset token |

### Anime
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/anime` | — | List with search/filter/sort/pagination |
| GET | `/anime/:id` | — | Detail with ratings |
| POST | `/anime` | admin | Create |
| PATCH | `/anime/:id` | admin | Update |
| DELETE | `/anime/:id` | admin | Delete |

### Ratings
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/anime/:id/ratings` | JWT | Upsert sub/dub rating (1–5) |
| GET | `/anime/:id/ratings/me` | JWT | Your rating |
| DELETE | `/anime/:id/ratings` | JWT | Remove your rating |
| GET | `/anime/:id/ratings/distribution` | — | Rating breakdown |

### Comments
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/anime/:id/comments` | — | Paginated comments + replies |
| POST | `/anime/:id/comments` | JWT | Post comment (supports parentId) |
| PATCH | `/anime/:id/comments/:cid` | JWT | Edit own comment |
| DELETE | `/anime/:id/comments/:cid` | JWT | Soft delete own comment |
| POST | `/anime/:id/comments/:cid/like` | JWT | Like (1) or dislike (-1) |
| DELETE | `/anime/:id/comments/:cid/like` | JWT | Remove vote |

### Admin (requires `role: admin`)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/admin/dashboard` | Stats + top anime + activity log |
| GET | `/admin/users` | List + search users |
| POST | `/admin/users/:id/ban` | Ban user (optional expiry) |
| POST | `/admin/users/:id/unban` | Lift ban |
| DELETE | `/admin/comments/:id` | Moderate comment |
| GET | `/admin/logs` | Admin action log |

---

## Security Implementation

| Layer | What's implemented |
|---|---|
| Passwords | bcrypt (12 rounds) |
| Access tokens | JWT, 15-min expiry, in-memory only |
| Refresh tokens | httpOnly cookie, SHA-256 hashed in DB, 7-day rotation |
| Brute-force | 5 failed logins → 15-min account lockout |
| Rate limiting | Global 100 req/60s; stricter on auth endpoints |
| Input validation | class-validator (NestJS) + whitelist stripping |
| SQL injection | Prisma ORM — parameterised queries only |
| XSS | Helmet CSP headers + Next.js output encoding |
| CSRF | SameSite=Strict cookies + CORS allowlist |
| Secure headers | Helmet: HSTS, X-Frame-Options, X-Content-Type-Options |
| Admin logging | Every moderation action stored with IP + metadata |
| Token reuse | Detected → all user sessions revoked immediately |

---

## Deployment Checklist

- [ ] Set `NODE_ENV=production`
- [ ] Use a strong, unique `JWT_SECRET` (64+ chars)
- [ ] Enable HTTPS / TLS termination at proxy level
- [ ] Point `DATABASE_URL` to production Postgres with SSL
- [ ] Configure SMTP for password reset emails
- [ ] Set `FRONTEND_URL` to your actual domain
- [ ] Enable Cloudflare or equivalent WAF + DDoS protection
- [ ] Set up log aggregation (e.g. Datadog, Logtail)
- [ ] Schedule a cron job to clean expired tokens:
  ```sql
  DELETE FROM password_reset_tokens WHERE expires_at < NOW();
  DELETE FROM refresh_tokens WHERE expires_at < NOW() AND revoked_at IS NOT NULL;
  ```
