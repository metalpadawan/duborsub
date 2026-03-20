# AniRate Base App

This is the runnable base application for the repo. It contains the Nest backend, the Next frontend, and the reference Prisma schema for the original project.

## What Runs Today

- `backend/` is the local Nest API
- `frontend/` is the local Next.js app
- the current development build persists local data to `backend/.data/anirate-db.json`, so it can boot without PostgreSQL
- `../../database/schema.sql` remains the canonical SQL schema for future database wiring

## Project Structure

```text
apps/anirate-base/
|-- backend/
|   |-- src/
|   `-- .env.example
|-- frontend/
|   |-- src/
|   `-- .env.local.example
`-- prisma/
    `-- schema.prisma
```

## Start The App

From the repo root:

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
- Do not edit generated output like `frontend/.next` or backend `dist`

## Related Docs

- Root repo guide: `../../README.md`
- Contribution guide: `../../CONTRIBUTING.md`
- Git workflow: `../../docs/git-workflow.md`
- Repo map: `../../docs/repo-map.md`
