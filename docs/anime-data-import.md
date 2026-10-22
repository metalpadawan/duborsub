# Anime Data Import

AniRate's catalogue holds every anime it can find in open sources: about 38,000 titles, from 1907 to announced shows. This guide covers loading it, keeping it fresh, and where each piece of data comes from.

Do not copy databases from sites that do not allow it, and do not scrape streaming or piracy sites. Use public APIs and openly licensed data only.

All the commands below run from the repo root and write straight to PostgreSQL (`DATABASE_URL` in `apps/anirate-base/backend/.env`), so the backend can stay up while they run. Start the database first with `npm run db:up` (or `npm run dev`).

## Load Or Refresh Everything

```powershell
npm --prefix apps/anirate-base/backend run refresh:anime
```

This runs three steps, which can also be run one at a time:

1. `export:anime:offline` downloads the latest [anime-offline-database](https://github.com/manami-project/anime-offline-database) release and builds the list in `apps/anirate-base/backend/.data/catalog/` (about 60 MB, git-ignored).
2. `fetch:anime:popularity` reads library sizes and English titles for Kitsu's 10,000 most popular titles (about five minutes, paced politely).
3. `import:anime:catalogue` writes the list into the catalogue.

The import is safe to rerun. A title keeps its id (`anilist-16498`, or `mal-…`, `kitsu-…`, `anidb-…` when AniList does not know it), so a rerun updates titles instead of duplicating them, and only rows that changed are written. A title already in the catalogue keeps its title, synopsis, genres, cover and dub flag; the import only fills what it lacks (other names, format, episode count, site ids) and refreshes popularity. Where the source only had a romaji name and Kitsu knows an English one, the English name becomes the title and the romaji name stays searchable.

The first import also removes the six sample titles a new database starts with, along with their demo ratings and notes. Pass `-- --keep-samples` to keep them.

Other options for `import:anime:catalogue`: `-- --dry-run` reports what would change without writing, and `-- --cross-referenced-only` skips the roughly 11,000 titles known to only one site (often stubs or duplicates).

### Keeping it fresh

anime-offline-database publishes new releases irregularly; the latest at the time of writing is from 4 July 2026. Run `refresh:anime` on a schedule wherever the database lives, for example weekly:

- **Windows (Task Scheduler):** a weekly task running `npm --prefix C:\path\to\duborsub\apps\anirate-base\backend run refresh:anime`.
- **Linux (cron):** `0 4 * * 1 cd /srv/duborsub && npm --prefix apps/anirate-base/backend run refresh:anime`.
- **Hosted:** a scheduled job (GitHub Actions `schedule`, a Railway or Render cron job) with `DATABASE_URL` set to the production database.

Because the import writes in batches and skips unchanged rows, a refresh with nothing new takes about ten seconds.

## Scope And Filters

- **Formats:** TV, movies, OVAs, web series (ONAs) and specials. The source has no music-video format, so a few music videos may remain.
- **Adult titles:** excluded when tagged `hentai`, or `erotica` outside TV and web series. The narrower rule keeps mainstream broadcasts such as Devilman Crybaby, which AniList does not mark adult.
- **Advertising clips:** excluded when they run under 10 minutes. Promotional tags also appear on real series such as Cyberpunk: Edgerunners.
- **Genres:** the source tags rather than classifies, so AniRate's 18 genres (AniList's set) are picked out of its tags.
- **Search:** every title keeps up to 150 other names (English, romaji, Japanese and translations), so "Attack on Titan", "Shingeki no Kyojin" and "進撃" all find the same show.

## English Dubs

No open source records which titles have an English dub, so it comes from the people who watched one:

- Any signed-in viewer can rate a title's dub, and rating it, or pressing "It has an English dub", files a dub report.
- Three reports from different viewers put the dub on record automatically.
- Admins see open reports at `/admin` and can confirm or dismiss them sooner, or set the flag directly in the title editor.

Imports never change a title's dub flag.

## AniList (when its API is available)

AniList adds synopses and English titles to its most popular titles:

```powershell
npm --prefix apps/anirate-base/backend run import:anime:anilist -- --pages 5 --per-page 50
```

To review AniList's whole catalogue as a file first, `export:anime:anilist` writes `.data/catalog/anilist-anime.json` and `.csv`, paced at AniList's rate limit; rerun with `-- --resume` if it stops. Both commands report AniList's own error message when it refuses requests (its API was disabled for stability problems in October 2026).

## Moving From The Old File Datastore

Before PostgreSQL, data lived in `apps/anirate-base/backend/.data/anirate-db.json` and `anirate-db.catalog.json`. To bring accounts, sessions, ratings, notes, dub reports, admin history and the catalogue across, with every id kept:

```powershell
npm --prefix apps/anirate-base/backend run migrate:json
```

It refuses to write into a database that already has accounts or titles; pass `-- --replace` to empty the database first (for example after a first `npm run dev` seeded the demo data). The JSON files are left untouched.

## Licences And Credits

- **anime-offline-database** is licensed under the ODbL (database) and DbCL (contents). Any public use of the catalogue, or of a database built from it, must credit it and keep the derived database under the ODbL. The site footer carries the credit; `export:anime:offline` also writes `ATTRIBUTION.md` next to the list.
- **Kitsu** popularity figures come from its public API; the footer credits it.
- **AniList** metadata belongs to AniList and its contributors.
- Ratings, notes and dub reports are AniRate's own user-generated data.
