# duborsub

This repository is organized around one runnable AniRate application, three incremental feature packs, a canonical database schema, and preserved source exports.

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
|   `-- schema.sql
|-- docs/
|   |-- git-workflow.md
|   `-- repo-map.md
`-- CONTRIBUTING.md
```

## Reading Order

1. Start with `apps/anirate-base`.
2. Review `feature-packs/v2-admin-email-deploy`.
3. Review `feature-packs/v3-profiles-watchlist-ops`.
4. Review `feature-packs/v4-growth-social-search`.

The `feature-packs/` directories are preserved add-on snapshots, not standalone apps.

## Run The App

Install dependencies if this is a fresh clone:

```powershell
npm --prefix ".\apps\anirate-base\backend" install
npm --prefix ".\apps\anirate-base\frontend" install
```

Start the backend in one terminal:

```powershell
npm --prefix ".\apps\anirate-base\backend" run start:dev
```

Start the frontend in another terminal:

```powershell
npm --prefix ".\apps\anirate-base\frontend" run dev
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

Important rule: edit maintained source files under `apps/anirate-base/backend/src` and `apps/anirate-base/frontend/src`, not generated output like `.next/`, `dist/`, or `node_modules/`.

## Notes

- The reconstructed local base app currently runs with seeded in-memory data for easy startup.
- The canonical SQL schema is `database/schema.sql`.
- Generated build output like `.next/` and `dist/` can be regenerated locally and is intentionally not part of the maintained source tree.
