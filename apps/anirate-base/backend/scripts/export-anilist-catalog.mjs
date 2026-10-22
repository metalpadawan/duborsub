// Exports AniList's full anime catalogue as a review list (JSON + CSV) before
// anything is imported. Adult titles and music videos are excluded. Each row notes
// whether AniRate already has the title, so the gaps in the database are visible.
//
//   node scripts/export-anilist-catalog.mjs [--resume] [--out <dir>]
//
// Paging is by ascending AniList ID (id_greater), not page number, so the walk is
// not subject to deep-pagination limits and can resume from its checkpoint.
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

const QUERY = `
  query ExportAnime($afterId: Int!, $perPage: Int!, $formats: [MediaFormat]) {
    Page(page: 1, perPage: $perPage) {
      pageInfo { hasNextPage }
      media(type: ANIME, isAdult: false, format_in: $formats, id_greater: $afterId, sort: ID) {
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

  let items = [];
  let afterId = 0;
  if (args.resume && existsSync(checkpointFile)) {
    const checkpoint = JSON.parse(readFileSync(checkpointFile, 'utf8'));
    items = checkpoint.items;
    afterId = checkpoint.afterId;
    console.log(`Resuming after AniList ID ${afterId} with ${items.length} titles already fetched.`);
  }

  let requests = 0;
  let lastRequestAt = 0;

  while (true) {
    const wait = lastRequestAt + MIN_INTERVAL_MS - Date.now();
    if (wait > 0) {
      await sleep(wait);
    }

    lastRequestAt = Date.now();
    let page;
    try {
      page = await fetchPage(afterId);
    } catch (error) {
      saveCheckpoint(items, afterId);
      console.error(`Stopped: ${error.message}`);
      console.error(`Progress is saved. Rerun with --resume to continue after AniList ID ${afterId}.`);
      return 1;
    }

    requests += 1;
    const media = page.media ?? [];
    items.push(...media.map((entry) => toRow(entry, inAniRate)));
    if (media.length) {
      afterId = media[media.length - 1].id;
    }

    if (requests % 20 === 0) {
      saveCheckpoint(items, afterId);
      console.log(`${items.length} titles so far (through AniList ID ${afterId})…`);
    }

    if (!page.pageInfo?.hasNextPage || media.length === 0) {
      break;
    }
  }

  writeOutputs(items);
  return 0;
}

async function fetchPage(afterId, attempt = 1) {
  const response = await fetch(ANILIST_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ query: QUERY, variables: { afterId, perPage: PER_PAGE, formats: FORMATS } }),
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
    return fetchPage(afterId, attempt + 1);
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

function saveCheckpoint(items, afterId) {
  writeAtomic(checkpointFile, JSON.stringify({ afterId, items }));
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
