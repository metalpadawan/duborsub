# AniRate Base App

This is the runnable base application for the repo: the Nest backend, with its PostgreSQL schema and migrations, and the Next frontend.

## What Runs Today

- `backend/` is the local Nest API
- `frontend/` is the local Next.js app
- data lives in PostgreSQL; locally it runs in Docker from the repo's `docker-compose.yml`
- `backend/prisma/schema.prisma` and its `migrations/` are the canonical database definition

## Project Structure

```text
apps/anirate-base/
|-- backend/
|   |-- prisma/          (schema.prisma and SQL migrations)
|   |-- scripts/         (catalogue import and export)
|   |-- src/
|   `-- .env.example
`-- frontend/
    |-- src/
    `-- .env.local.example
```

## Start The App

Start Docker Desktop, copy `backend/.env.example` to `backend/.env`, then from the repo root:

```powershell
npm run dev
```

If stale processes are still holding onto ports:

```powershell
npm run dev:fresh
```

If you need to install app dependencies from the root first:

```powershell
npm run setup
```

Quality checks from the repo root:

```powershell
npm run lint
npm run test
```

Open:

- `http://localhost:3000`
- `http://localhost:4000/api/v1`

Demo accounts:

- `demo@example.com` / `Password123!`
- `admin@example.com` / `Password123!`

## Source Of Truth

- Edit backend code in `backend/src`
- Edit frontend code in `frontend/src`
- Change the database through `backend/prisma/schema.prisma`, then `npm --prefix apps/anirate-base/backend run db:migrate -- --name <change>` to write the migration
- Do not edit generated output like `frontend/.next` or backend `dist`

## Related Docs

- Root repo guide: `../../README.md`
- Contribution guide: `../../CONTRIBUTING.md`
- Git workflow: `../../docs/git-workflow.md`
- Repo map: `../../docs/repo-map.md`
