# AniRate Base App

This is the runnable base application for the repo. It contains the Nest backend, the Next frontend, and the reference Prisma schema for the original project.

## What Runs Today

- `backend/` is the local Nest API
- `frontend/` is the local Next.js app
- the current development build uses seeded in-memory data so it can boot without PostgreSQL
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
npm --prefix ".\apps\anirate-base\backend" run start:dev
```

In a second terminal:

```powershell
npm --prefix ".\apps\anirate-base\frontend" run dev
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
