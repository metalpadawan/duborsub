# Anime Data Import

Do not access or copy private databases from third-party sites. Fill the local AniRate catalog from public metadata APIs or from data you are allowed to use.

## AniList Import

Start the backend once first so it creates `apps/anirate-base/backend/.data/anirate-db.json`, then **stop it**. The backend holds the whole datastore in memory and rewrites the file on every change, so an import made while it runs would be overwritten by its next save. The script checks `http://localhost:4000/api/v1/health` and refuses to run while the backend answers (override the URL with `--api-url`, or skip the check with `--force`).

Then import popular anime metadata from AniList:

```powershell
npm --prefix apps/anirate-base/backend run import:anime:anilist -- --pages 5 --per-page 50
```

This adds or updates records using stable IDs like `anilist-21`, stores genres, descriptions, cover URLs, release years, and status, and writes the datastore atomically. Start the backend again afterwards; the homepage reads the catalog from the API, so imported titles appear within a minute (the catalog cache and page revalidation both run on a 60-second cycle).

Notes:

- AniList metadata does not tell us whether a title has an English dub, so imported records default `hasDub` to `false`.
- Ratings and comments remain local user-generated data.
- Increase `--pages` gradually to avoid hammering public APIs.
