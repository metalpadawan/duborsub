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

Then open:

- `http://localhost:3000`
- `http://localhost:4000/api/v1`

Demo accounts:

- `demo@example.com` / `Password123!`
- `admin@example.com` / `Password123!`

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
