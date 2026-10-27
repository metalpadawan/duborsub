// Brings AniList's synopses and English titles into the catalogue. It writes straight
// to PostgreSQL, so the backend can stay up.
//
//   node scripts/import-anilist.mjs --from-export     fill in every title from the
//                                                      export-anilist-catalog.mjs file
//   node scripts/import-anilist.mjs [--pages 5] [--per-page 50]
//                                                      refresh the most popular titles live
//
// The export mode only fills gaps: a synopsis or English title someone already set is
// kept. The live mode refreshes AniList's fields on the titles it fetches. Neither
// touches a title's dub flag.
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildSearchText, CATALOG_EXPORT_DIR, chunks, connect, genreIdsByName, parseArgs, sortTitleOf } from './lib/db.mjs';

const ANILIST_API = 'https://graphql.anilist.co';
// AniList's TV_SHORT is folded into TV, matching the catalogue's formats.
const CATALOG_FORMATS = { TV: 'TV', TV_SHORT: 'TV', MOVIE: 'MOVIE', OVA: 'OVA', ONA: 'ONA', SPECIAL: 'SPECIAL' };

const args = parseArgs(process.argv.slice(2));
const pages = clamp(Number(args.pages ?? 1), 1, 100);
const perPage = clamp(Number(args['per-page'] ?? 50), 1, 50);

// Failures set process.exitCode and return instead of calling process.exit(), which
// can abort Node on Windows while a just-finished fetch is still closing its handles.
process.exitCode = await main();

async function main() {
  if (args['from-export']) {
    return importFromExport();
  }

  const prisma = connect();
  let imported = 0;
  let updated = 0;

  try {
    for (let page = 1; page <= pages; page += 1) {
      const result = await fetchAniListPage(page, perPage);
      const media = result.data.Page.media;
      const genreIds = await genreIdsByName(prisma, [...new Set(media.flatMap((entry) => entry.genres ?? []))]);

      for (const entry of media) {
        const record = toAnimeRecord(entry);
        const genres = (entry.genres ?? []).map((name) => ({ genreId: genreIds.get(name.toLowerCase()) }));
        const existing = await prisma.anime.findUnique({ where: { id: record.id }, select: { id: true } });

        // The dub flag is set by viewers and admins, so a metadata refresh never touches it.
        await prisma.anime.upsert({
          where: { id: record.id },
          create: { ...record, hasDub: false, genres: { create: genres } },
          update: { ...record, genres: { deleteMany: {}, create: genres } },
        });

        if (existing) updated += 1;
        else imported += 1;
      }
    }
  } catch (error) {
    console.error(`Stopped: ${error.message}`);
    console.error(`Added ${imported} and updated ${updated} titles before stopping.`);
    return 1;
  } finally {
    await prisma.$disconnect();
  }

  console.log(`AniList import complete. Added ${imported}, updated ${updated}.`);
  return 0;
}

async function importFromExport() {
  const file = resolve(String(args.file ?? resolve(CATALOG_EXPORT_DIR, 'anilist-anime.json')));
  if (!existsSync(file)) {
    console.error(`${file} not found. Run "npm run export:anime:anilist" first.`);
    return 1;
  }

  const started = Date.now();
  const rows = JSON.parse(readFileSync(file, 'utf8')).items;
  const prisma = connect();
  const counts = { synopses: 0, englishTitles: 0, covers: 0, genres: 0, unchanged: 0, missing: 0 };

  try {
    const genreIds = await genreIdsByName(prisma, [...new Set(rows.flatMap((row) => row.genres ?? []))]);
    const existing = new Map(
      (
        await prisma.anime.findMany({
          where: { id: { in: rows.map((row) => `anilist-${row.anilistId}`) } },
          select: { id: true, title: true, description: true, alternativeTitles: true, coverImageUrl: true, _count: { select: { genres: true } } },
        })
      ).map((anime) => [anime.id, anime]),
    );

    const updates = [];
    const genreLinks = [];
    for (const row of rows) {
      const current = existing.get(`anilist-${row.anilistId}`);
      if (!current) {
        counts.missing += 1;
        continue;
      }

      const data = {};
      if (!current.description && row.description) {
        data.description = row.description;
        counts.synopses += 1;
      }

      // Rename only a title still carrying a romaji or native name.
      let title = current.title;
      if (row.titleEnglish && row.titleEnglish !== title && [row.titleRomaji, row.titleNative].includes(title)) {
        title = row.titleEnglish.slice(0, 255);
        data.title = title;
        counts.englishTitles += 1;
      }

      const names = mergeNames(title, [...current.alternativeTitles, row.titleRomaji, row.titleEnglish, row.titleNative, ...(row.synonyms ?? [])]);
      if (data.title || names.length !== current.alternativeTitles.length) {
        data.alternativeTitles = names;
        data.sortTitle = sortTitleOf(title);
        data.searchText = buildSearchText(title, names);
      }

      if (!current.coverImageUrl && row.coverImageUrl) {
        data.coverImageUrl = row.coverImageUrl;
        counts.covers += 1;
      }

      if (current._count.genres === 0 && row.genres?.length) {
        row.genres.forEach((name) => genreLinks.push({ animeId: current.id, genreId: genreIds.get(name.toLowerCase()) }));
        counts.genres += 1;
      }

      if (Object.keys(data).length) updates.push({ id: current.id, data });
      else counts.unchanged += 1;
    }

    console.log(
      `Synopses added: ${counts.synopses}. English titles: ${counts.englishTitles}. Covers: ${counts.covers}. Genres: ${counts.genres}. Already complete: ${counts.unchanged}. Not in the catalogue: ${counts.missing}.`,
    );
    if (args['dry-run']) {
      console.log('Dry run: nothing was written.');
      return 0;
    }

    for (const batch of chunks(updates, 500)) {
      await prisma.$transaction(batch.map(({ id, data }) => prisma.anime.update({ where: { id }, data })));
    }
    for (const batch of chunks(genreLinks, 5000)) {
      await prisma.animeGenre.createMany({ data: batch, skipDuplicates: true });
    }
    console.log(`Done in ${Math.round((Date.now() - started) / 1000)}s: ${updates.length} titles updated.`);
    return 0;
  } finally {
    await prisma.$disconnect();
  }
}

function mergeNames(title, candidates) {
  const seen = new Set([title.toLowerCase()]);
  const result = [];
  for (const candidate of candidates) {
    const value = String(candidate ?? '').trim().slice(0, 255);
    if (value && !seen.has(value.toLowerCase())) {
      seen.add(value.toLowerCase());
      result.push(value);
    }
    if (result.length === 150) break;
  }
  return result;
}

function clamp(value, min, max) {
  if (!Number.isFinite(value)) {
    return min;
  }

  return Math.min(Math.max(Math.floor(value), min), max);
}

async function fetchAniListPage(page, perPage) {
  const response = await fetch(ANILIST_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      query: `
        query ImportAnime($page: Int!, $perPage: Int!) {
          Page(page: $page, perPage: $perPage) {
            media(type: ANIME, isAdult: false, sort: POPULARITY_DESC) {
              id
              idMal
              title {
                romaji
                english
                native
              }
              synonyms
              format
              episodes
              popularity
              description(asHtml: false)
              coverImage {
                large
                extraLarge
              }
              startDate {
                year
              }
              status
              genres
            }
          }
        }
      `,
      variables: { page, perPage },
    }),
  });

  if (!response.ok) {
    const reason = await response
      .json()
      .then((body) => body.errors?.map((error) => error.message).join('; '))
      .catch(() => null);
    throw new Error(`AniList request failed: ${response.status} ${reason || response.statusText}`);
  }

  return response.json();
}

function toAnimeRecord(media) {
  const title = media.title?.english || media.title?.romaji || `AniList ${media.id}`;
  const alternativeTitles = [media.title?.romaji, media.title?.english, media.title?.native, ...(media.synonyms ?? [])]
    .filter((name, index, names) => name && name !== title && names.indexOf(name) === index);

  return {
    id: `anilist-${media.id}`,
    title,
    sortTitle: sortTitleOf(title),
    searchText: buildSearchText(title, alternativeTitles),
    description: normalizeDescription(media.description),
    coverImageUrl: media.coverImage?.extraLarge || media.coverImage?.large || null,
    releaseYear: media.startDate?.year ?? null,
    status: mapStatus(media.status),
    alternativeTitles,
    format: CATALOG_FORMATS[media.format] ?? null,
    episodes: media.episodes ?? null,
    externalIds: media.idMal ? { anilist: media.id, mal: media.idMal } : { anilist: media.id },
  };
}

function normalizeDescription(description) {
  return String(description ?? '')
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function mapStatus(status) {
  if (status === 'RELEASING') {
    return 'airing';
  }

  if (status === 'NOT_YET_RELEASED') {
    return 'upcoming';
  }

  return 'completed';
}
