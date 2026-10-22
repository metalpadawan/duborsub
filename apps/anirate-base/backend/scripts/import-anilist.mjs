// Imports AniList's most popular titles, with synopses and English titles, into the
// catalogue. It writes straight to PostgreSQL, so the backend can stay up.
//
//   node scripts/import-anilist.mjs [--pages 5] [--per-page 50]
import { buildSearchText, connect, genreIdsByName, parseArgs, sortTitleOf } from './lib/db.mjs';

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
