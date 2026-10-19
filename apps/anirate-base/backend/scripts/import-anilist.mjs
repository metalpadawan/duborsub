import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_FILE = process.env.DATA_FILE
  ? resolve(process.env.DATA_FILE)
  : resolve(__dirname, '..', '.data', 'anirate-db.json');
const ANILIST_API = 'https://graphql.anilist.co';

const args = parseArgs(process.argv.slice(2));
const pages = clamp(Number(args.pages ?? 1), 1, 100);
const perPage = clamp(Number(args['per-page'] ?? 50), 1, 50);
const apiUrl = String(args['api-url'] ?? `http://localhost:${process.env.PORT ?? 4000}/api/v1`);

// Failures set process.exitCode and return instead of calling process.exit(), which
// can abort Node on Windows while a just-finished fetch is still closing its handles.
process.exitCode = await main();

async function main() {
  if (!existsSync(DATA_FILE)) {
    console.error(`Datastore not found at ${DATA_FILE}`);
    console.error('Start the backend once first so it creates the local datastore, stop it, then rerun this import.');
    return 1;
  }

  // The backend keeps the whole datastore in memory and rewrites the file on every
  // change, so importing while it runs would be silently overwritten on its next save.
  if (!args.force && (await isBackendRunning(apiUrl))) {
    console.error(`The AniRate backend is running at ${apiUrl}.`);
    console.error('Stop it before importing, otherwise its next save overwrites the imported anime.');
    console.error('Pass --force to import anyway (for example if that URL belongs to another service).');
    return 1;
  }

  await importAnime();
  return 0;
}

async function importAnime() {
  const snapshot = JSON.parse(readFileSync(DATA_FILE, 'utf8'));
  snapshot.genres ??= [];
  snapshot.anime ??= [];
  snapshot.ratings ??= [];
  snapshot.comments ??= [];
  snapshot.commentLikes ??= [];
  snapshot.refreshTokens ??= [];
  snapshot.passwordResetTokens ??= [];
  snapshot.adminLogs ??= [];

  let imported = 0;
  let updated = 0;

  for (let page = 1; page <= pages; page += 1) {
    const result = await fetchAniListPage(page, perPage);

    for (const media of result.data.Page.media) {
      const anime = toAnimeRecord(media, snapshot);
      const existingIndex = snapshot.anime.findIndex((entry) => entry.id === anime.id);

      if (existingIndex >= 0) {
        snapshot.anime[existingIndex] = {
          ...snapshot.anime[existingIndex],
          ...anime,
          updatedAt: new Date().toISOString(),
        };
        updated += 1;
      } else {
        snapshot.anime.push(anime);
        imported += 1;
      }
    }
  }

  // Write to a temp file and rename so an interrupted import cannot leave a
  // half-written datastore behind.
  const tempFile = `${DATA_FILE}.import-${process.pid}.tmp`;
  writeFileSync(tempFile, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');
  renameSync(tempFile, DATA_FILE);
  console.log(`AniList import complete. Added ${imported}, updated ${updated}.`);
}

async function isBackendRunning(url) {
  try {
    const response = await fetch(`${url.replace(/\/$/, '')}/health`, {
      signal: AbortSignal.timeout(1500),
    });
    return response.ok;
  } catch {
    return false;
  }
}

function parseArgs(rawArgs) {
  const parsed = {};

  for (let index = 0; index < rawArgs.length; index += 1) {
    const arg = rawArgs[index];
    if (!arg.startsWith('--')) {
      continue;
    }

    const [rawKey, inlineValue] = arg.slice(2).split('=');
    parsed[rawKey] = inlineValue ?? rawArgs[index + 1] ?? true;

    if (inlineValue === undefined && rawArgs[index + 1] && !rawArgs[index + 1].startsWith('--')) {
      index += 1;
    }
  }

  return parsed;
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
            media(type: ANIME, sort: POPULARITY_DESC) {
              id
              title {
                romaji
                english
              }
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
    throw new Error(`AniList request failed: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

function toAnimeRecord(media, snapshot) {
  const now = new Date().toISOString();
  const title = media.title?.english || media.title?.romaji || `AniList ${media.id}`;

  return {
    id: `anilist-${media.id}`,
    title,
    description: normalizeDescription(media.description),
    coverImageUrl: media.coverImage?.extraLarge || media.coverImage?.large || null,
    releaseYear: media.startDate?.year ?? null,
    hasDub: false,
    status: mapStatus(media.status),
    genres: (media.genres ?? []).map((name) => getOrCreateGenre(snapshot, name)),
    createdAt: now,
    updatedAt: now,
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

function getOrCreateGenre(snapshot, name) {
  const existing = snapshot.genres.find((genre) => genre.name.toLowerCase() === name.toLowerCase());
  if (existing) {
    return existing;
  }

  const maxId = snapshot.genres.reduce((max, genre) => Math.max(max, Number(genre.id) || 0), 0);
  const genre = { id: maxId + 1, name };
  snapshot.genres.push(genre);
  return genre;
}
