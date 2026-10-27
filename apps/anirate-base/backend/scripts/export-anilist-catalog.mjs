// Exports AniList's full anime catalogue as a review list (JSON + CSV) before
// anything is imported. Adult titles and music videos are excluded. Each row notes
// whether AniRate already has the title, so the gaps in the database are visible.
//
//   node scripts/export-anilist-catalog.mjs [--resume] [--out <dir>]
//
// AniList stops any listing at 5,000 results and has no "after this id" filter, so
// the walk asks for known ids instead: every AniList id in the offline catalogue
// (export-offline-catalog.mjs, run first), 50 per request. It can resume from its
// checkpoint.
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { CATALOG_EXPORT_DIR, loadCatalogIds, parseArgs, writeAtomic } from './lib/db.mjs';

const ANILIST_API = 'https://graphql.anilist.co';
const FORMATS = ['TV', 'TV_SHORT', 'MOVIE', 'SPECIAL', 'OVA', 'ONA'];
const PER_PAGE = 50;
// AniList allows 90 requests a minute and drops to 30 when degraded; pace for 30.
const MIN_INTERVAL_MS = 2_100;

const args = parseArgs(process.argv.slice(2));
const outDir = resolve(String(args.out ?? CATALOG_EXPORT_DIR));
const checkpointFile = resolve(outDir, 'anilist-anime.checkpoint.json');
const offlineFile = resolve(CATALOG_EXPORT_DIR, 'anime-catalogue.json');

const QUERY = `
  query ExportAnime($ids: [Int], $perPage: Int!, $formats: [MediaFormat]) {
    Page(page: 1, perPage: $perPage) {
      media(type: ANIME, isAdult: false, format_in: $formats, id_in: $ids, sort: ID) {
        id
        idMal
        title { romaji english native }
        synonyms
        format
        status
        episodes
        duration
        season
        seasonYear
        startDate { year month day }
        endDate { year month day }
        genres
        studios(isMain: true) { nodes { name } }
        source
        countryOfOrigin
        averageScore
        popularity
        coverImage { extraLarge large }
        siteUrl
        description(asHtml: false)
      }
    }
  }
`;

process.exitCode = await main();

async function main() {
  mkdirSync(outDir, { recursive: true });
  const inAniRate = (await loadCatalogIds()).anilist;

  if (!existsSync(offlineFile)) {
    console.error(`${offlineFile} not found. Run "npm run export:anime:offline" first: it lists the AniList ids to fetch.`);
    return 1;
  }

  const ids = [...new Set(JSON.parse(readFileSync(offlineFile, 'utf8')).items.map((item) => item.anilistId).filter(Boolean))].sort(
    (left, right) => left - right,
  );
  const batches = [];
  for (let index = 0; index < ids.length; index += PER_PAGE) batches.push(ids.slice(index, index + PER_PAGE));

  let items = [];
  let batchIndex = 0;
  if (args.resume && existsSync(checkpointFile)) {
    const checkpoint = JSON.parse(readFileSync(checkpointFile, 'utf8'));
    items = checkpoint.items;
    batchIndex = checkpoint.batchIndex ?? 0;
    console.log(`Resuming at request ${batchIndex + 1} of ${batches.length} with ${items.length} titles already fetched.`);
  }

  console.log(`Fetching ${ids.length} AniList titles in ${batches.length - batchIndex} requests (about ${Math.ceil(((batches.length - batchIndex) * MIN_INTERVAL_MS) / 60_000)} minutes)…`);
  let lastRequestAt = 0;

  for (; batchIndex < batches.length; batchIndex += 1) {
    const wait = lastRequestAt + MIN_INTERVAL_MS - Date.now();
    if (wait > 0) {
      await sleep(wait);
    }

    lastRequestAt = Date.now();
    let page;
    try {
      page = await fetchPage(batches[batchIndex]);
    } catch (error) {
      saveCheckpoint(items, batchIndex);
      console.error(`Stopped: ${error.message}`);
      console.error(`Progress is saved. Rerun with --resume to continue at request ${batchIndex + 1}.`);
      return 1;
    }

    items.push(...(page.media ?? []).map((entry) => toRow(entry, inAniRate)));

    if ((batchIndex + 1) % 20 === 0) {
      saveCheckpoint(items, batchIndex + 1);
      console.log(`${items.length} titles so far (${batchIndex + 1} of ${batches.length} requests)…`);
    }
  }

  writeOutputs(items);
  return 0;
}

async function fetchPage(ids, attempt = 1) {
  const response = await fetch(ANILIST_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ query: QUERY, variables: { ids, perPage: PER_PAGE, formats: FORMATS } }),
    signal: AbortSignal.timeout(30_000),
  });

  if (response.status === 429 || response.status >= 500) {
    if (attempt > 6) {
      throw new Error(`AniList kept answering ${response.status} after ${attempt - 1} retries`);
    }

    // Respect AniList's own back-off when it gives one; otherwise back off exponentially.
    const retryAfter = Number(response.headers.get('retry-after'));
    const delay = Number.isFinite(retryAfter) && retryAfter > 0 ? (retryAfter + 1) * 1000 : 2 ** attempt * 1000;
    console.log(`AniList answered ${response.status}; waiting ${Math.round(delay / 1000)}s before retrying.`);
    await sleep(delay);
    return fetchPage(ids, attempt + 1);
  }

  if (!response.ok) {
    // AniList explains outages and refusals in the error body; surface its words.
    const reason = await response
      .json()
      .then((body) => body.errors?.map((error) => error.message).join('; '))
      .catch(() => null);
    throw new Error(`AniList request failed: ${response.status} ${reason || response.statusText}`);
  }

  const body = await response.json();
  if (body.errors?.length) {
    throw new Error(`AniList returned errors: ${body.errors.map((error) => error.message).join('; ')}`);
  }

  return body.data.Page;
}

function toRow(media, inAniRate) {
  return {
    anilistId: media.id,
    malId: media.idMal ?? null,
    titleEnglish: media.title?.english ?? null,
    titleRomaji: media.title?.romaji ?? null,
    titleNative: media.title?.native ?? null,
    synonyms: media.synonyms ?? [],
    format: media.format,
    status: media.status,
    episodes: media.episodes ?? null,
    durationMinutes: media.duration ?? null,
    season: media.season ?? null,
    seasonYear: media.seasonYear ?? null,
    startDate: formatDate(media.startDate),
    endDate: formatDate(media.endDate),
    genres: media.genres ?? [],
    mainStudio: media.studios?.nodes?.[0]?.name ?? null,
    source: media.source ?? null,
    countryOfOrigin: media.countryOfOrigin ?? null,
    averageScore: media.averageScore ?? null,
    popularity: media.popularity ?? null,
    coverImageUrl: media.coverImage?.extraLarge || media.coverImage?.large || null,
    anilistUrl: media.siteUrl,
    description: normalizeDescription(media.description),
    inAniRate: inAniRate.has(media.id),
  };
}

function writeOutputs(items) {
  const generatedAt = new Date().toISOString();
  const jsonPath = resolve(outDir, 'anilist-anime.json');
  const csvPath = resolve(outDir, 'anilist-anime.csv');

  writeAtomic(
    jsonPath,
    `${JSON.stringify(
      {
        generatedAt,
        source: 'AniList GraphQL API (https://anilist.co). Metadata belongs to AniList and its contributors.',
        filters: { type: 'ANIME', isAdult: false, formats: FORMATS },
        count: items.length,
        alreadyInAniRate: items.filter((item) => item.inAniRate).length,
        items,
      },
      null,
      2,
    )}\n`,
  );

  const columns = [
    ['anilist_id', (item) => item.anilistId],
    ['mal_id', (item) => item.malId],
    ['title_english', (item) => item.titleEnglish],
    ['title_romaji', (item) => item.titleRomaji],
    ['title_native', (item) => item.titleNative],
    ['format', (item) => item.format],
    ['status', (item) => item.status],
    ['episodes', (item) => item.episodes],
    ['duration_min', (item) => item.durationMinutes],
    ['season', (item) => item.season],
    ['season_year', (item) => item.seasonYear],
    ['start_date', (item) => item.startDate],
    ['end_date', (item) => item.endDate],
    ['genres', (item) => item.genres.join('; ')],
    ['main_studio', (item) => item.mainStudio],
    ['source', (item) => item.source],
    ['country', (item) => item.countryOfOrigin],
    ['average_score', (item) => item.averageScore],
    ['popularity', (item) => item.popularity],
    ['in_anirate', (item) => (item.inAniRate ? 'yes' : 'no')],
    ['cover_url', (item) => item.coverImageUrl],
    ['anilist_url', (item) => item.anilistUrl],
  ];

  const lines = [
    columns.map(([name]) => name).join(','),
    ...items.map((item) => columns.map(([, read]) => csvCell(read(item))).join(',')),
  ];
  // The byte-order mark lets Excel read the Japanese titles as UTF-8.
  writeAtomic(csvPath, `﻿${lines.join('\r\n')}\r\n`);

  const byFormat = items.reduce((counts, item) => ({ ...counts, [item.format]: (counts[item.format] ?? 0) + 1 }), {});
  console.log(`Exported ${items.length} titles (${items.filter((item) => item.inAniRate).length} already in AniRate).`);
  console.log(`By format: ${Object.entries(byFormat).map(([format, count]) => `${format} ${count}`).join(', ')}`);
  console.log(`JSON: ${jsonPath}`);
  console.log(`CSV:  ${csvPath}`);
}

function saveCheckpoint(items, batchIndex) {
  writeAtomic(checkpointFile, JSON.stringify({ batchIndex, items }));
}

function csvCell(value) {
  if (value === null || value === undefined) {
    return '';
  }

  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function formatDate(date) {
  if (!date?.year) {
    return null;
  }

  const parts = [date.year, date.month, date.day].filter(Boolean).map((part, index) => (index === 0 ? String(part) : String(part).padStart(2, '0')));
  return parts.join('-');
}

function normalizeDescription(description) {
  return String(description ?? '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim() || null;
}

function sleep(ms) {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}
