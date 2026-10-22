# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Two audiences carry equal weight:

- **Anime viewers** deciding how to watch a title. Their job: find a show, see whether the community rates the subtitled or the dubbed version higher, and add their own split rating or a short note.
- **Hiring managers and senior engineers** evaluating the project as a portfolio piece. Their job: judge product thinking, visual and motion craft, and engineering quality within the first few seconds, then confirm it holds up as a working product when they click through.

## Product Purpose

AniRate is a community database that rates each anime's sub and dub separately, so a viewer can choose the version worth watching instead of reading one blended score. Success means a visitor can answer "sub or dub?" for a title at a glance, and an evaluator comes away convinced the product, design, and code were made with senior-level care.

## Positioning

The split rating is the product. Every title carries two independent community scores (sub and dub) and the gap between them; neighboring sites publish one score per show and cannot truthfully claim this comparison.

## Operating Context

- Browsing and searching a catalog of roughly 250 titles imported from AniList's public metadata, plus six seed titles.
- Signed-in users rate sub and dub on a 1–5 scale independently and post one-level threaded comments.
- Admins moderate users and comments through the API; there is no admin UI in the base app.
- Runs as a Next.js frontend (port 3000) over a NestJS API (port 4000) with a file-backed datastore.

## Capabilities and Constraints

- Routes: home/catalog (`/`, `/catalog/[page]`, `/catalog/search` with search, sort by title/top rated/most voted/newest, genre filter, pagination), anime detail (`/anime/[id]`), sign in, register, forgot password.
- Home and catalog pages are server-rendered and must stay fully usable without JavaScript. Light, progressive JavaScript is allowed for motion and enhancement only.
- Cover image URLs exist for imported titles (AniList CDN); seed titles have none, so every image surface needs a designed no-image state.
- AniList does not report dub availability, so imported titles default to "sub only" until edited; the design must not imply dub data that does not exist.
- Watchlists, profiles, social feed, and OAuth exist only as unmerged feature packs and are not part of this product yet.

## Brand Commitments

- Name: **AniRate**. Fixed.
- Core idea: separate sub vs dub ratings per anime. Fixed, and the design should be built around it.

## Evidence on Hand

- Real catalog data: titles, descriptions, genres, release years, status, and cover art for ~250 AniList titles in the local datastore.
- Community data is thin: a handful of seeded ratings and comments. Do not fabricate rating counts, testimonials, user numbers, press, or awards.

## Product Principles

1. The comparison comes first: sub score, dub score, and the gap must be legible before anything else about a title.
2. Earn trust with restraint: show only data that exists, and label what is missing instead of filling it.
3. Work without JavaScript, feel alive with it: motion enhances content that is already there.
4. Craft is the proof: every state (empty, loading, error, signed-out) is designed, because evaluators click everything.

## Accessibility & Inclusion

Keyboard-operable throughout, visible focus states, WCAG AA contrast, and all motion honors `prefers-reduced-motion`.
