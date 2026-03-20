# Repository Map

This repo contains a single AniRate codebase split into one base application and three additive feature packs.

## Base App

- `apps/anirate-base`
- Full-stack starting point with the core backend, frontend, and Prisma schema.
- Includes auth, anime CRUD, ratings, comments, admin basics, and the original project documentation.

## Feature Pack Order

1. `feature-packs/v2-admin-email-deploy`
2. `feature-packs/v3-profiles-watchlist-ops`
3. `feature-packs/v4-growth-social-search`

Each pack assumes the previous layer already exists.

## What Each Pack Adds

### v2 Admin, Email, Deploy

- Admin dashboard pages
- Password reset and registration UI additions
- Mail module and health endpoint
- Testing, Docker, deployment, and CI files

### v3 Profiles, Watchlist, Ops

- Public user profiles
- Watchlist backend and frontend
- Redis cache helpers
- Image upload module and cover uploader UI
- Spam protection utilities

### v4 Growth, Social, Search

- Recommendations
- Social follow/feed features
- OAuth modules and callback UI
- Advanced search and stats pages

## Database Assets

- `database/schema.sql` is the canonical SQL schema to use.
- `apps/anirate-base/prisma/schema.prisma` is the Prisma model source for the base app.

## Cleanup Notes

- The old double-nested extracted folders were flattened.
- Empty brace-named extraction artifact folders were removed from the working tree.
- Archived zip exports, duplicate SQL copies, and generated build output were removed to keep the repo leaner.
