// Imports the full anime list written by export-offline-catalog.mjs into the AniRate
// catalogue, so every title can be found and rated. Titles already in the catalogue
// keep their curated fields (title, synopsis, dub flag, genres); the import only fills
// what they are missing and adds alternative titles for search.
//
//   node scripts/import-catalogue.mjs [--file <anime-catalogue.json>] [--cross-referenced-only] [--keep-samples] [--dry-run]
//
// When .data/catalog/kitsu-popularity.json exists (fetch-kitsu-popularity.mjs), titles
// also get a popularity figure and, where the source only had a romaji name, the
// English title. The six demo titles a fresh database starts with are removed, with
// their demo ratings and notes, unless --keep-samples is passed.
//
// It writes straight to PostgreSQL, so the backend can stay up while it runs.
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildSearchText, CATALOG_EXPORT_DIR, chunks, connect, genreIdsByName, parseArgs, recordId, sortTitleOf } from './lib/db.mjs';

const args = parseArgs(process.argv.slice(2));
const sourceFile = resolve(String(args.file ?? resolve(CATALOG_EXPORT_DIR, 'anime-catalogue.json')));
const popularityFile = resolve(CATALOG_EXPORT_DIR, 'kitsu-popularity.json');
// The demo titles SeedService puts in a fresh database (SAMPLE_ANIME there).
const SAMPLE_IDS = [
  'ff0c8c69-b21f-4dfa-a22b-1bfba63c20e3',
  '00955f2a-9ded-443c-ae93-6eb7e6e987ec',
  'ce094da3-7f20-4b11-aa7e-d9540691520d',
  '665c3d83-1862-4d22-bd19-a3a69c3720f5',
  'aeae9dd3-554e-47bf-9bb7-297566662dd1',
  'a9a18938-2963-46ba-ae87-6bfabdd1ecb8',
];
// High enough that a title known in dozens of languages keeps its Japanese name too.
const MAX_ALTERNATIVE_TITLES = 150;
const MAX_TITLE_LENGTH = 255;

// The source database tags rather than classifies, so AniRate's genre list is
// picked out of the tags.
const GENRE_TAGS = {
  Action: ['action'],
  Adventure: ['adventure'],
  Comedy: ['comedy'],
  Drama: ['drama'],
  Ecchi: ['ecchi'],
  Fantasy: ['fantasy'],
  Horror: ['horror'],
  'Mahou Shoujo': ['mahou shoujo', 'magical girl'],
  Mecha: ['mecha'],
  Music: ['music'],
  Mystery: ['mystery'],
  Psychological: ['psychological'],
  Romance: ['romance'],
  'Sci-Fi': ['sci-fi', 'science fiction'],
  'Slice of Life': ['slice of life'],
  Sports: ['sports'],
  Supernatural: ['supernatural'],
  Thriller: ['thriller'],
};

process.exitCode = await main();

async function main() {
  if (!existsSync(sourceFile)) {
    console.error(`Catalogue list not found at ${sourceFile}`);
    console.error('Run "npm run export:anime:offline" first to build it.');
    return 1;
  }

  const started = Date.now();
  const source = JSON.parse(readFileSync(sourceFile, 'utf8'));
  const popularity = existsSync(popularityFile) ? JSON.parse(readFileSync(popularityFile, 'utf8')).byKitsuId : null;
  const prisma = connect();

  try {
    const genreIds = await genreIdsByName(prisma, Object.keys(GENRE_TAGS));
    const existing = new Map(
      (
        await prisma.anime.findMany({
          select: {
            id: true,
            title: true,
            alternativeTitles: true,
            format: true,
            episodes: true,
            externalIds: true,
            releaseYear: true,
            coverImageUrl: true,
            popularity: true,
            sortTitle: true,
            searchText: true,
            _count: { select: { genres: true } },
          },
        })
      ).map((anime) => [anime.id, anime]),
    );

    const creates = [];
    const updates = [];
    const genreLinks = [];
    const counts = { added: 0, changed: 0, unchanged: 0, skippedNoId: 0, skippedSingleSite: 0, duplicates: 0, popular: 0, englishTitles: 0 };
    const seen = new Set();

    for (const entry of source.items) {
      if (args['cross-referenced-only'] && !entry.crossReferenced) {
        counts.skippedSingleSite += 1;
        continue;
      }

      const id = recordId(entry.sources);
      if (!id) {
        counts.skippedNoId += 1;
        continue;
      }

      // The source merges each title across sites, so a repeated ID is a source error.
      if (seen.has(id)) {
        counts.duplicates += 1;
        continue;
      }
      seen.add(id);

      const kitsu = popularity && entry.kitsuId ? popularity[entry.kitsuId] : null;
      const current = existing.get(id);
      const record = current ? enriched(current, entry) : fresh(id, entry);

      if (popularity) {
        record.popularity = kitsu?.userCount ?? null;
        if (record.popularity !== null) counts.popular += 1;
        // Only a title still carrying the source's romaji name is renamed; a title an
        // import or an admin already set (usually English) is left alone.
        if (kitsu?.titleEnglish && record.title === entry.title && kitsu.titleEnglish !== entry.title) {
          record.title = kitsu.titleEnglish.slice(0, MAX_TITLE_LENGTH);
          record.alternativeTitles = alternativeTitles(record.title, [entry.title, ...record.alternativeTitles]);
          counts.englishTitles += 1;
        }
      }

      record.sortTitle = sortTitleOf(record.title);
      record.searchText = buildSearchText(record.title, record.alternativeTitles);

      const genres = mapGenres(entry.tags).map((name) => genreIds.get(name.toLowerCase()));
      if (!current) {
        creates.push(record);
        genres.forEach((genreId) => genreLinks.push({ animeId: id, genreId }));
        counts.added += 1;
      } else {
        // Curated genres stay; a title with none gets the source's.
        if (current._count.genres === 0) {
          genres.forEach((genreId) => genreLinks.push({ animeId: id, genreId }));
        }

        const data = changedFields(current, record);
        if (data) {
          updates.push({ id, data });
          counts.changed += 1;
        } else {
          counts.unchanged += 1;
        }
      }
    }

    const samples = args['keep-samples'] ? [] : SAMPLE_IDS.filter((sampleId) => existing.has(sampleId));

    console.log(`Source: ${source.source?.name ?? sourceFile} (release ${source.source?.lastUpdate ?? 'unknown'}).`);
    console.log(`New titles: ${counts.added}. Existing titles updated: ${counts.changed}, already current: ${counts.unchanged}.`);
    if (counts.skippedSingleSite) console.log(`Skipped ${counts.skippedSingleSite} titles known to only one site (--cross-referenced-only).`);
    if (counts.skippedNoId) console.log(`Skipped ${counts.skippedNoId} titles with no recognised site ID.`);
    if (counts.duplicates) console.log(`Skipped ${counts.duplicates} repeated IDs.`);
    if (popularity) console.log(`Popularity for ${counts.popular} titles; ${counts.englishTitles} renamed to their English title.`);
    else console.log('No kitsu-popularity.json found: popularity and English titles were not updated.');
    if (samples.length) console.log(`Removing the ${samples.length} sample titles and their demo ratings, notes and dub reports.`);

    if (args['dry-run']) {
      console.log('Dry run: nothing was written.');
      return 0;
    }

    for (const batch of chunks(creates, 1000)) {
      await prisma.anime.createMany({ data: batch });
    }
    for (const batch of chunks(updates, 500)) {
      await prisma.$transaction(batch.map(({ id, data }) => prisma.anime.update({ where: { id }, data })));
    }
    for (const batch of chunks(genreLinks, 5000)) {
      await prisma.animeGenre.createMany({ data: batch, skipDuplicates: true });
    }
    if (samples.length) {
      // Ratings, notes and dub reports cascade with the titles.
      await prisma.anime.deleteMany({ where: { id: { in: samples } } });
    }

    console.log(`Done in ${Math.round((Date.now() - started) / 1000)}s. The catalogue holds ${await prisma.anime.count()} titles.`);
    return 0;
  } finally {
    await prisma.$disconnect();
  }
}

function fresh(id, entry) {
  const title = entry.title.slice(0, MAX_TITLE_LENGTH);
  return {
    id,
    title,
    description: '',
    coverImageUrl: coverUrl(entry.coverImageUrl),
    releaseYear: entry.year ?? null,
    hasDub: false,
    status: mapStatus(entry.status, entry.year),
    format: entry.type,
    episodes: entry.episodes ?? null,
    alternativeTitles: alternativeTitles(title, [entry.title, ...entry.synonyms]),
    externalIds: externalIds(entry),
    popularity: null,
  };
}

// An existing title keeps what it has and gains what the source adds.
function enriched(current, entry) {
  return {
    title: current.title,
    alternativeTitles: alternativeTitles(current.title, [...current.alternativeTitles, entry.title, ...entry.synonyms]),
    format: current.format ?? entry.type,
    episodes: current.episodes ?? entry.episodes ?? null,
    externalIds: { ...externalIds(entry), ...(current.externalIds ?? {}) },
    releaseYear: current.releaseYear ?? entry.year ?? null,
    coverImageUrl: current.coverImageUrl || coverUrl(entry.coverImageUrl),
    popularity: current.popularity,
  };
}

function changedFields(current, record) {
  // The folded columns are compared too, so a change to the folding is applied on the next run.
  const data = {};
  for (const key of ['title', 'alternativeTitles', 'format', 'episodes', 'externalIds', 'releaseYear', 'coverImageUrl', 'popularity', 'sortTitle', 'searchText']) {
    if (stable(current[key]) !== stable(record[key])) {
      data[key] = record[key];
    }
  }

  return Object.keys(data).length ? data : null;
}

// PostgreSQL stores JSON with its keys reordered, so objects compare by sorted keys.
function stable(value) {
  return JSON.stringify(value ?? null, (_key, inner) =>
    inner && typeof inner === 'object' && !Array.isArray(inner)
      ? Object.fromEntries(Object.entries(inner).sort(([left], [right]) => left.localeCompare(right)))
      : inner,
  );
}

function alternativeTitles(title, candidates) {
  const seen = new Set([title.toLowerCase()]);
  const result = [];

  for (const candidate of candidates) {
    const value = String(candidate ?? '').trim().slice(0, MAX_TITLE_LENGTH);
    const key = value.toLowerCase();
    if (!value || seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(value);
    if (result.length === MAX_ALTERNATIVE_TITLES) {
      break;
    }
  }

  return result;
}

function externalIds(entry) {
  const ids = {};
  if (entry.anilistId) ids.anilist = entry.anilistId;
  if (entry.malId) ids.mal = entry.malId;
  if (entry.kitsuId) ids.kitsu = entry.kitsuId;
  if (entry.anidbId) ids.anidb = entry.anidbId;
  return ids;
}

// Titles without art point at the source's placeholder image; the site draws its own.
function coverUrl(url) {
  return url && !/no_?pic/i.test(url) ? url : null;
}

function mapStatus(status, year) {
  if (status === 'ONGOING') return 'airing';
  if (status === 'UPCOMING') return 'upcoming';
  if (status === 'FINISHED') return 'completed';
  return year && year <= new Date().getFullYear() ? 'completed' : 'upcoming';
}

function mapGenres(tags) {
  return Object.entries(GENRE_TAGS)
    .filter(([, names]) => names.some((name) => tags.includes(name)))
    .map(([name]) => name);
}
