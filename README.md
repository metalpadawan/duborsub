# duborsub

This repository is organized around one base AniRate application, three incremental feature packs, a canonical database schema, and preserved source exports.

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
|   `-- repo-map.md
`-- archives/
    |-- duplicates/
    |   `-- schema-copy.sql
    `-- exports/
        |-- anime-platform.zip
        |-- anime-platform-v2.zip
        |-- anime-platform-v3.zip
        `-- anime-platform-v4.zip
```

## Reading Order

1. Start with `apps/anirate-base`.
2. Layer `feature-packs/v2-admin-email-deploy` on top of the base app.
3. Layer `feature-packs/v3-profiles-watchlist-ops` after v2.
4. Layer `feature-packs/v4-growth-social-search` after v3.

The `feature-packs/` directories are not standalone applications. They are staged additions to the base app.

## Notes

- The reconstructed local base app currently runs with seeded in-memory data for easy startup.
- The canonical SQL schema is `database/schema.sql`.
- The duplicate SQL export was preserved as `archives/duplicates/schema-copy.sql`.
- The original zip exports were moved to `archives/exports/`.
- A detailed repository walkthrough lives in `docs/repo-map.md`.
