// Fetches popularity (Kitsu library user counts) and English titles for the most
// popular titles on Kitsu, for import-catalogue.mjs to merge by Kitsu ID. Kitsu's
// public API needs no key; requests are paced and retried politely.
//
//   node scripts/fetch-kitsu-popularity.mjs [--top 10000] [--concurrency 3]
//
// Writes .data/catalog/kitsu-popularity.json. Only reads from Kitsu; touches no database.
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { CATALOG_EXPORT_DIR, parseArgs, writeAtomic } from './lib/db.mjs';

const KITSU_API = 'https://kitsu.app/api/edge/anime';
const PAGE_SIZE = 20; // Kitsu's maximum
const args = parseArgs(process.argv.slice(2));
const top = Math.max(PAGE_SIZE, Number(args.top ?? 10_000));
const concurrency = Math.min(6, Math.max(1, Number(args.concurrency ?? 3)));
const outFile = resolve(CATALOG_EXPORT_DIR, 'kitsu-popularity.json');

process.exitCode = await main();

async function main() {
  const offsets = [];
  for (let offset = 0; offset < top; offset += PAGE_SIZE) offsets.push(offset);

  const byKitsuId = {};
  let done = 0;
  let total = null;

  try {
    await runPool(offsets, concurrency, async (offset) => {
      const page = await fetchPage(offset);
      total ??= page.meta?.count ?? null;
      for (const entry of page.data ?? []) {
        const attributes = entry.attributes ?? {};
        byKitsuId[entry.id] = {
          userCount: attributes.userCount ?? null,
          popularityRank: attributes.popularityRank ?? null,
          titleEnglish: attributes.titles?.en || attributes.titles?.en_us || null,
        };
      }

      done += 1;
      if (done % 50 === 0) console.log(`${done}/${offsets.length} pages…`);
    });
  } catch (error) {
    console.error(`Stopped: ${error.message}`);
    return 1;
  }

  mkdirSync(CATALOG_EXPORT_DIR, { recursive: true });
  writeAtomic(
    outFile,
    JSON.stringify({
      generatedAt: new Date().toISOString(),
      source: 'Kitsu API (https://kitsu.app). Popularity is the number of Kitsu users with the title in their library.',
      kitsuTotal: total,
      count: Object.keys(byKitsuId).length,
      byKitsuId,
    }),
  );
  console.log(`Fetched popularity for ${Object.keys(byKitsuId).length} titles (of ${total ?? '?'} on Kitsu).`);
  console.log(`Written to ${outFile}`);
  return 0;
}

async function fetchPage(offset, attempt = 1) {
  const params = new URLSearchParams({
    sort: 'popularityRank',
    'page[limit]': String(PAGE_SIZE),
    'page[offset]': String(offset),
    'fields[anime]': 'titles,userCount,popularityRank',
  });

  let response;
  try {
    response = await fetch(`${KITSU_API}?${params}`, {
      headers: { Accept: 'application/vnd.api+json', 'User-Agent': 'AniRate-catalogue-import' },
      signal: AbortSignal.timeout(30_000),
    });
  } catch (error) {
    if (attempt > 5) throw error;
    await sleep(2 ** attempt * 1000);
    return fetchPage(offset, attempt + 1);
  }

  if (response.status === 429 || response.status >= 500) {
    if (attempt > 5) throw new Error(`Kitsu kept answering ${response.status} at offset ${offset}`);
    const retryAfter = Number(response.headers.get('retry-after'));
    await sleep(Number.isFinite(retryAfter) && retryAfter > 0 ? (retryAfter + 1) * 1000 : 2 ** attempt * 1000);
    return fetchPage(offset, attempt + 1);
  }

  if (!response.ok) {
    throw new Error(`Kitsu answered ${response.status} at offset ${offset}`);
  }

  return response.json();
}

async function runPool(items, size, worker) {
  let next = 0;
  await Promise.all(
    Array.from({ length: size }, async () => {
      while (next < items.length) {
        const item = items[next];
        next += 1;
        await worker(item);
        await sleep(150);
      }
    }),
  );
}

function sleep(ms) {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}
