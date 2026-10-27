# duborsub

This repository is organized around one runnable AniRate application, three incremental feature packs, and preserved source exports.

## Repository Layout

```text
.
|-- apps/
|   `-- anirate-base/
|-- feature-packs/
|   |-- v2-admin-email-deploy/
|   |-- v3-profiles-watchlist-ops/
|   `-- v4-growth-social-search/
|-- database/
|   `-- init/              (creates the test database in local PostgreSQL)
|-- docs/
|   |-- git-workflow.md
|   |-- prototypes/
|   `-- repo-map.md
|-- docker-compose.yml     (local PostgreSQL)
`-- CONTRIBUTING.md
```

## Reading Order

1. Start with `apps/anirate-base`.
2. Review `feature-packs/v2-admin-email-deploy`.
3. Review `feature-packs/v3-profiles-watchlist-ops`.
4. Review `feature-packs/v4-growth-social-search`.

The `feature-packs/` directories are preserved add-on snapshots, not standalone apps.

## Run The App

AniRate stores everything in PostgreSQL. Locally it runs in Docker, so install and start [Docker Desktop](https://www.docker.com/products/docker-desktop/) first.

Install root tooling if this is a fresh clone:

```powershell
npm install
```

Install app dependencies if needed:

```powershell
npm run setup
```

Start everything from the repo root. This starts PostgreSQL (`npm run db:up`), applies any new migrations, then runs the backend and frontend. The first run creates the git-ignored `.env` files: a random database password in the repo-root `.env`, and `apps/anirate-base/backend/.env` from its example (set `JWT_SECRET` there, as the example explains). Database passwords never go in tracked files, and the database only listens on this machine.

```powershell
npm run dev
```

A new database starts with demo accounts and six sample titles. To load every anime (about 38,000 titles), see [docs/anime-data-import.md](docs/anime-data-import.md). `npm run db:down` stops the database; its data stays in a Docker volume.

If old dev servers are still hanging onto ports, do a clean restart:

```powershell
npm run dev:fresh
```

If you just want to see which ports are occupied:

```powershell
npm run ports:status
```

Build both apps from the repo root:

```powershell
npm run build
```

Run the quality checks from the repo root (the backend tests need the database running, and wipe the separate `anime_platform_test` database):

```powershell
npm run lint
npm run test
```

The browser tests (`apps/anirate-base/frontend/e2e`) drive the running site through the main visitor, member and admin flows. Start the site first, then:

```powershell
npm --prefix apps/anirate-base/frontend run test:e2e
```

On a machine with 8 GB of memory, the dev servers (especially the Next.js one, which compiles pages as you visit them) can run out of room alongside Docker, VS Code and a browser, and stop without an error. When that happens, run the built apps instead, which use a fraction of the memory:

```powershell
npm run build        # after changing code
npm run start:local  # database, API and website, without live reloading
```

Then open:

- `http://localhost:3000`
- `http://localhost:4000/api/v1`

Demo accounts:

- `demo@example.com` / `Password123!`
- `admin@example.com` / `Password123!`

Emails (sign-up confirmation, password resets) are printed to the backend's log in development until `SMTP_*` settings are added to `apps/anirate-base/backend/.env`; follow the link from the log to confirm a new account.

## What The Site Does

- **Catalogue:** about 38,000 anime with search in English, Japanese and romaji, sorted by popularity, rating, votes, year or title.
- **Ratings:** members rate the sub and the dub of each title separately (1 to 5), once their email address is confirmed.
- **Dub reports:** members say when a title has an English dub; three reports, or an admin, put it on record.
- **Title requests:** anyone can request a missing title at `/request`, or from a search with no results; admins review the queue and key titles in at `/admin`.
- **Moderation:** members report notes; admins remove notes, ban members, and see an activity log.
- **Accounts:** sign-up with email confirmation, password reset by email, My ratings, and self-service account deletion.

## Deploying

[docs/deploy.md](docs/deploy.md) covers putting the site on a server with HTTPS (`docker-compose.prod.yml`), email, loading the catalogue, updates, and daily backups (`npm run db:backup` locally, `node database/backup.mjs --prod` on the server).

## Git And Contribution Docs

- `CONTRIBUTING.md` explains the repo contribution workflow.
- `docs/git-workflow.md` lists common Git commands and repo-specific guardrails.
- `docs/repo-map.md` gives a fuller walkthrough of the repo structure.
- `docs/prototypes/` holds static UI prototypes for web, desktop, iOS, and Android; open `docs/prototypes/index.html` in a browser.

Important rule: edit maintained source files under `apps/anirate-base/backend/src` and `apps/anirate-base/frontend/src`, not generated output like `.next/`, `dist/`, or `node_modules/`.

## Notes

- Data lives in PostgreSQL. The schema is `apps/anirate-base/backend/prisma/schema.prisma`, and the SQL migrations beside it in `prisma/migrations/` are the canonical database definition.
- To load or refresh the full anime catalogue, see [docs/anime-data-import.md](docs/anime-data-import.md).
- Generated build output like `.next/` and `dist/` can be regenerated locally and is intentionally not part of the maintained source tree.
