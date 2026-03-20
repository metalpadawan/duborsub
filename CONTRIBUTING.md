# Contributing

This repo is organized so the runnable application lives in `apps/anirate-base`, while the `feature-packs/` folders preserve later snapshots and add-on reference code.

## Where To Work

- Backend source of truth: `apps/anirate-base/backend/src`
- Frontend source of truth: `apps/anirate-base/frontend/src`
- Repo docs: `README.md`, `docs/`, and `apps/anirate-base/README.md`
- Reference-only folders: `feature-packs/`, `archives/`, `.next/`, `dist/`, `node_modules/`

If you need to change behavior, edit the source files, not generated output.

## Local Setup

Install dependencies:

```powershell
npm --prefix ".\apps\anirate-base\backend" install
npm --prefix ".\apps\anirate-base\frontend" install
```

Run the app:

```powershell
npm --prefix ".\apps\anirate-base\backend" run start:dev
npm --prefix ".\apps\anirate-base\frontend" run dev
```

## Suggested Git Workflow

1. Pull the latest changes before starting new work.
2. Create a focused branch for your change.
3. Keep commits small and descriptive.
4. Run the relevant build or test commands before committing.
5. Review `git diff` before you commit so generated files do not slip in.

## Branch Naming

Use short branch names that describe the work:

- `feat/catalog-filters`
- `fix/login-error-state`
- `docs/git-workflow`

## Commit Messages

Use clear, present-tense commit subjects:

- `feat: add comment thread delete action`
- `fix: refresh auth token on reload`
- `docs: add git workflow guide`

## Before You Commit

Check what changed:

```powershell
git status
git diff --stat
git diff
```

Stage only the files you intend to keep:

```powershell
git add apps/anirate-base/frontend/src/app/page.tsx
git add docs/git-workflow.md
```

Commit:

```powershell
git commit -m "docs: improve git workflow guidance"
```

## Validation

The most useful checks for this repo are:

```powershell
npm --prefix ".\apps\anirate-base\backend" run build
npm --prefix ".\apps\anirate-base\frontend" run build
```

See `docs/git-workflow.md` for a slightly more detailed command reference.
