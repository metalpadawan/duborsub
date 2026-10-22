// Shared database access for the import and export scripts. They talk to the same
// PostgreSQL database as the backend (DATABASE_URL in backend/.env), so they can run
// while the site is up.
import { existsSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import prismaClient from '@prisma/client';

const backendRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const envFile = resolve(backendRoot, '.env');
if (!process.env.DATABASE_URL && existsSync(envFile)) {
  process.loadEnvFile(envFile);
}

export const CATALOG_EXPORT_DIR = resolve(backendRoot, '.data', 'catalog');
export const { Prisma } = prismaClient;

export function connect() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set. Add it to apps/anirate-base/backend/.env (see .env.example).');
  }

  return new prismaClient.PrismaClient();
}

// The same folding as src/common/search/search-key.ts; keep the two in step.
export function searchKey(value) {
  return String(value)
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

export function buildSearchText(title, alternativeTitles) {
  return [title, ...alternativeTitles].map(searchKey).filter(Boolean).join(' | ');
}

export function sortTitleOf(title) {
  return searchKey(title) || `~${title.toLowerCase()}`;
}

// The first matching site gives the record its ID; AniList first so existing
// "anilist-21" records line up, then the other sites by how stable their IDs are.
const ID_SOURCES = [
  ['anilist', /anilist\.co\/anime\/(\d+)/],
  ['mal', /myanimelist\.net\/anime\/(\d+)/],
  ['kitsu', /kitsu\.(?:app|io)\/anime\/(\d+)/],
  ['anidb', /anidb\.net\/anime\/(\d+)/],
  ['anisearch', /anisearch\.com\/anime\/(\d+)/],
  ['livechart', /livechart\.me\/anime\/(\d+)/],
  ['simkl', /simkl\.com\/anime\/(\d+)/],
  ['ann', /animenewsnetwork\.com\/encyclopedia\/anime\.php\?id=(\d+)/],
  ['animecountdown', /animecountdown\.com\/(\d+)/],
  ['notifymoe', /notify\.moe\/anime\/([A-Za-z0-9_-]+)/],
  ['animeplanet', /anime-planet\.com\/anime\/([a-z0-9-]+)/],
];


/** The catalogue id an offline-database entry is imported under, e.g. "anilist-21". */
export function recordId(sources) {
  for (const [prefix, pattern] of ID_SOURCES) {
    for (const source of sources ?? []) {
      const match = pattern.exec(source);
      if (match) {
        // Resource IDs are capped at 64 URL-safe characters (ParseResourceIdPipe).
        return `${prefix}-${match[1]}`.slice(0, 64);
      }
    }
  }

  return null;
}

/** Ids of every title in the catalogue, plus their AniList ids, read-only. */
export async function loadCatalogIds() {
  const ids = new Set();
  const anilist = new Set();
  let prisma;

  try {
    prisma = connect();
    const rows = await prisma.anime.findMany({ select: { id: true, externalIds: true } });
    for (const row of rows) {
      ids.add(row.id);
      const anilistId = row.externalIds?.anilist ?? Number(/^anilist-(\d+)$/.exec(row.id)?.[1]);
      if (anilistId) anilist.add(anilistId);
    }
  } catch (error) {
    // An export is still useful without the "already in AniRate" column.
    console.warn(`Could not read the catalogue, so in_anirate will be "no" throughout: ${error.message}`);
  } finally {
    await prisma?.$disconnect();
  }

  return { ids, anilist };
}

/** Genre ids by name, creating any genre the catalogue does not have yet. */
export async function genreIdsByName(prisma, names) {
  await prisma.genre.createMany({ data: names.map((name) => ({ name })), skipDuplicates: true });
  const genres = await prisma.genre.findMany();
  return new Map(genres.map((genre) => [genre.name.toLowerCase(), genre.id]));
}

// Write to a temp file and rename, so an interrupted run never leaves a half-written file.
export function writeAtomic(path, contents) {
  const tempFile = `${path}.${process.pid}.tmp`;
  writeFileSync(tempFile, contents, 'utf8');
  renameSync(tempFile, path);
}

export function parseArgs(rawArgs) {
  const parsed = {};

  for (let index = 0; index < rawArgs.length; index += 1) {
    const arg = rawArgs[index];
    if (!arg.startsWith('--')) {
      continue;
    }

    const [rawKey, inlineValue] = arg.slice(2).split('=');
    const next = rawArgs[index + 1];
    if (inlineValue !== undefined) {
      parsed[rawKey] = inlineValue;
    } else if (next !== undefined && !next.startsWith('--')) {
      parsed[rawKey] = next;
      index += 1;
    } else {
      parsed[rawKey] = true;
    }
  }

  return parsed;
}

/** Splits an array into chunks, for batched writes. */
export function chunks(items, size) {
  const result = [];
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }
  return result;
}
