// Builds the full anime review list (JSON + CSV) from manami-project's open
// anime-offline-database, which cross-references MyAnimeList, AniList, Kitsu,
// AniDB and others. Used while the AniList API is unavailable, and as a
// completeness check against it. Nothing is imported; the database is only read.
//
//   node scripts/export-offline-catalog.mjs [--download] [--file <json>] [--out <dir>]
//
// The database is ODbL/DbCL licensed: anything published from it must credit it
// (see the ATTRIBUTION.md this script writes next to the list).
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { CATALOG_EXPORT_DIR, loadCatalogIds, parseArgs, recordId, writeAtomic } from './lib/db.mjs';

const RELEASES_API = 'https://api.github.com/repos/manami-project/anime-offline-database/releases/latest';
const ASSET = 'anime-offline-database-minified.json';
const MAIN_FORMATS = new Set(['TV', 'MOVIE', 'OVA', 'ONA', 'SPECIAL']);
// Adult titles: "hentai" always; "erotica" only on direct-to-video formats, where the
// explicit releases live. On TV and web series it also tags mainstream broadcasts
// (Devilman Crybaby, Junjou Romantica) that AniList does not mark adult. Broader tags
// ("pornography", "adult audience only") would drop shows such as Kill la Kill.
const ADULT_TAG = 'hentai';
const ADULT_VIDEO_TAG = 'erotica';
const SERIES_FORMATS = new Set(['TV', 'ONA']);
// Advertising clips are dropped only when short; the same tags sit on real series
// such as Cyberpunk: Edgerunners.
const PROMO_TAGS = ['promotional', 'commercials', 'commercial', 'advertisement'];
const PROMO_CLIP_MAX_SECONDS = 600;

const args = parseArgs(process.argv.slice(2));
const outDir = resolve(String(args.out ?? CATALOG_EXPORT_DIR));
const sourceFile = resolve(String(args.file ?? resolve(CATALOG_EXPORT_DIR, 'source', ASSET)));

process.exitCode = await main();

async function main() {
  if (args.download || !existsSync(sourceFile)) {
    try {
      await download();
    } catch (error) {
      console.error(`Could not download the offline database: ${error.message}`);
      return 1;
    }
  }

  const db = JSON.parse(readFileSync(sourceFile, 'utf8'));
  const inAniRate = await loadCatalogIds();
  const excluded = { format: 0, adult: 0, promotional: 0 };

  const items = [];
  for (const entry of db.data) {
    const tags = entry.tags ?? [];
    if (!MAIN_FORMATS.has(entry.type)) {
      excluded.format += 1;
      continue;
    }

    if (tags.includes(ADULT_TAG) || (tags.includes(ADULT_VIDEO_TAG) && !SERIES_FORMATS.has(entry.type))) {
      excluded.adult += 1;
      continue;
    }

    const shortClip = !entry.duration || entry.duration.value < PROMO_CLIP_MAX_SECONDS;
    if (entry.type !== 'TV' && entry.type !== 'MOVIE' && shortClip && PROMO_TAGS.some((tag) => tags.includes(tag))) {
      excluded.promotional += 1;
      continue;
    }

    items.push(toRow(entry, inAniRate));
  }

  items.sort((left, right) => left.title.localeCompare(right.title, 'en', { sensitivity: 'base' }));
  writeOutputs(db, items, excluded);
  return 0;
}

async function download() {
  mkdirSync(dirname(sourceFile), { recursive: true });
  const release = await fetchJson(RELEASES_API);
  const asset = release.assets?.find((candidate) => candidate.name === ASSET);
  if (!asset) {
    throw new Error(`release ${release.tag_name} has no ${ASSET}`);
  }

  console.log(`Downloading ${ASSET} from release ${release.tag_name} (${(asset.size / 1e6).toFixed(1)} MB)…`);
  const response = await fetch(asset.browser_download_url, { signal: AbortSignal.timeout(300_000) });
  if (!response.ok) {
    throw new Error(`download failed: ${response.status} ${response.statusText}`);
  }

  const tempFile = `${sourceFile}.${process.pid}.tmp`;
  writeFileSync(tempFile, Buffer.from(await response.arrayBuffer()));
  renameSync(tempFile, sourceFile);
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'AniRate-catalogue-export' },
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) {
    throw new Error(`${url} answered ${response.status}`);
  }

  return response.json();
}

function toRow(entry, inAniRate) {
  const anilistId = idFrom(entry.sources, /anilist\.co\/anime\/(\d+)/);
  const malId = idFrom(entry.sources, /myanimelist\.net\/anime\/(\d+)/);
  const kitsuId = idFrom(entry.sources, /kitsu\.(?:app|io)\/anime\/(\d+)/);
  const anidbId = idFrom(entry.sources, /anidb\.net\/anime\/(\d+)/);
  const durationSeconds = entry.duration?.unit === 'SECONDS' ? entry.duration.value : null;

  return {
    title: entry.title,
    anilistId,
    malId,
    kitsuId,
    anidbId,
    type: entry.type,
    status: entry.status,
    episodes: entry.episodes || null,
    durationMinutes: durationSeconds ? Math.round(durationSeconds / 60) : null,
    season: entry.animeSeason?.season && entry.animeSeason.season !== 'UNDEFINED' ? entry.animeSeason.season : null,
    year: entry.animeSeason?.year ?? null,
    score: entry.score ? Math.round(entry.score.arithmeticMean * 100) / 100 : null,
    studios: entry.studios ?? [],
    tags: entry.tags ?? [],
    synonyms: entry.synonyms ?? [],
    coverImageUrl: entry.picture || null,
    sources: entry.sources,
    // Entries known to a single site are often stubs or unmerged sequels; worth a check.
    crossReferenced: entry.sources.length > 1,
    // The same id the importer would give it, so this matches whatever is in the catalogue.
    inAniRate: inAniRate.ids.has(recordId(entry.sources)),
  };
}

function writeOutputs(db, items, excluded) {
  mkdirSync(outDir, { recursive: true });
  const jsonPath = resolve(outDir, 'anime-catalogue.json');
  const csvPath = resolve(outDir, 'anime-catalogue.csv');
  const attributionPath = resolve(outDir, 'ATTRIBUTION.md');
  const linkedToAniList = items.filter((item) => item.anilistId !== null).length;
  const alreadyInAniRate = items.filter((item) => item.inAniRate).length;

  writeAtomic(
    jsonPath,
    `${JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        source: {
          name: 'anime-offline-database by manami-project',
          repository: db.repository,
          lastUpdate: db.lastUpdate,
          license: db.license,
        },
        filters: {
          formats: [...MAIN_FORMATS],
          excludedAdult: `tag "${ADULT_TAG}", or "${ADULT_VIDEO_TAG}" outside TV/ONA`,
          excludedPromotional: `tags ${PROMO_TAGS.join(', ')} on non-TV/movie entries under ${PROMO_CLIP_MAX_SECONDS / 60} minutes`,
          excludedCounts: excluded,
        },
        count: items.length,
        linkedToAniList,
        alreadyInAniRate,
        items,
      },
      null,
      2,
    )}\n`,
  );

  const columns = [
    ['title', (item) => item.title],
    ['type', (item) => item.type],
    ['status', (item) => item.status],
    ['episodes', (item) => item.episodes],
    ['duration_min', (item) => item.durationMinutes],
    ['season', (item) => item.season],
    ['year', (item) => item.year],
    ['score_10', (item) => item.score],
    ['studios', (item) => item.studios.join('; ')],
    ['top_tags', (item) => item.tags.slice(0, 8).join('; ')],
    ['in_anirate', (item) => (item.inAniRate ? 'yes' : 'no')],
    ['source_count', (item) => item.sources.length],
    ['cross_referenced', (item) => (item.crossReferenced ? 'yes' : 'no')],
    ['anilist_id', (item) => item.anilistId],
    ['mal_id', (item) => item.malId],
    ['kitsu_id', (item) => item.kitsuId],
    ['anidb_id', (item) => item.anidbId],
    ['cover_url', (item) => item.coverImageUrl],
    ['anilist_url', (item) => (item.anilistId ? `https://anilist.co/anime/${item.anilistId}` : null)],
    ['mal_url', (item) => (item.malId ? `https://myanimelist.net/anime/${item.malId}` : null)],
  ];

  const lines = [
    columns.map(([name]) => name).join(','),
    ...items.map((item) => columns.map(([, read]) => csvCell(read(item))).join(',')),
  ];
  // The byte-order mark lets Excel read non-Latin titles and tags as UTF-8.
  writeAtomic(csvPath, `﻿${lines.join('\r\n')}\r\n`);

  writeAtomic(
    attributionPath,
    `# Attribution

The anime catalogue in this folder is derived from **anime-offline-database** by manami-project:
${db.repository}

Release: ${db.lastUpdate}
License: ${db.license?.name} — ${db.license?.url}

The database is made available under the Open Database License (ODbL) v1.0, and its
individual contents under the Database Contents License (DbCL) v1.0. Any public use of
this catalogue, or of a database built from it, must credit the source above and keep
the derived database under the ODbL.
`,
  );

  const byType = items.reduce((counts, item) => ({ ...counts, [item.type]: (counts[item.type] ?? 0) + 1 }), {});
  console.log(`Exported ${items.length} titles from the ${db.lastUpdate} release.`);
  console.log(`By type: ${Object.entries(byType).map(([type, count]) => `${type} ${count}`).join(', ')}`);
  console.log(`Known to one site only (worth a check): ${items.filter((item) => !item.crossReferenced).length}.`);
  console.log(`Linked to AniList: ${linkedToAniList}. Already in AniRate: ${alreadyInAniRate}. Missing from AniRate: ${items.length - alreadyInAniRate}.`);
  console.log(`Excluded: ${excluded.adult} adult, ${excluded.promotional} promotional clips, ${excluded.format} unknown format.`);
  console.log(`JSON: ${jsonPath}`);
  console.log(`CSV:  ${csvPath}`);
  console.log(`Attribution: ${attributionPath}`);
}

function idFrom(sources, pattern) {
  for (const source of sources ?? []) {
    const match = pattern.exec(source);
    if (match) {
      return Number(match[1]);
    }
  }

  return null;
}

function csvCell(value) {
  if (value === null || value === undefined) {
    return '';
  }

  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}
