# Git Workflow

This guide is the repo-specific version of "how do I work safely here?"

## Golden Rules

- Work in `apps/anirate-base/backend/src` and `apps/anirate-base/frontend/src`.
- Treat `.next/`, `dist/`, and `node_modules/` as generated output.
- Keep feature-pack folders as references unless you are intentionally porting code from them.
- Read `git status` before and after each chunk of work.

## Common Commands

See current changes:

```powershell
git status
git diff --stat
git diff
```

Create a branch:

```powershell
git checkout -b feat/your-change
```

Stage selected files:

```powershell
git add apps/anirate-base/backend/src
git add apps/anirate-base/frontend/src
git add README.md CONTRIBUTING.md docs/git-workflow.md
```

Commit:

```powershell
git commit -m "feat: describe the change"
```

Push:

```powershell
git push -u origin feat/your-change
```

## Staying Clean

Before committing, make sure you are not accidentally including:

- `.next/` build output
- `dist/` build output
- `node_modules/`
- local secrets from `.env`

If you see those files in `git status`, stop and remove them from your commit.

## Pulling New Changes

If the branch has moved forward:

```powershell
git pull --rebase
```

If you already have local edits, check the diff first so you understand what might conflict.

## Useful Run Commands

Install root tooling:

```powershell
npm install
```

Install app dependencies:

```powershell
npm run setup
```

Start both apps:

```powershell
npm run dev
```

Cleanly stop the common local dev ports and restart:

```powershell
npm run dev:fresh
```

If you need to run them separately:

Backend:

```powershell
npm --prefix ".\apps\anirate-base\backend" run start:dev
```

Frontend:

```powershell
npm --prefix ".\apps\anirate-base\frontend" run dev
```

Validation:

```powershell
npm run lint
npm run test
npm run build
```
