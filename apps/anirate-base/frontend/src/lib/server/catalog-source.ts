import type { Anime, Genre, PaginatedAnime } from '@/lib/api';
import { catalogItems as fallbackCatalogItems, genreOptions as fallbackGenreOptions } from '@/lib/catalog-data';
import type { SortKey } from '@/lib/catalog-view';
import { internalApiHeaders, resolveServerApiUrl } from '@/lib/server/api-base';

// The catalogue holds tens of thousands of titles, so search, sorting and paging
// happen in the API and each page asks for just the slice it shows. Only the genre
// list and the featured candidates, which every page shares, are cached here.
const CACHE_TTL_MS = 60_000;
const REQUEST_TIMEOUT_MS = 5_000;
const FEATURED_CANDIDATES = 24;

const API_SORT: Record<SortKey, { sortBy: string; order: 'asc' | 'desc' }> = {
  relevance: { sortBy: 'relevance', order: 'asc' },
  popular: { sortBy: 'popular', order: 'desc' },
  title: { sortBy: 'title', order: 'asc' },
  rating: { sortBy: 'rating', order: 'desc' },
  votes: { sortBy: 'votes', order: 'desc' },
  year: { sortBy: 'year', order: 'desc' },
};

export type CatalogQuery = {
  search: string;
  sort: SortKey;
  genreId: number | null;
  page: number;
  limit: number;
};

export type CatalogPage = {
  items: Anime[];
  page: number;
  total: number;
  pages: number;
};

let genreCache: { expiresAt: number; genres: Genre[] } | null = null;
let featuredCache: { expiresAt: number; items: Anime[] } | null = null;

async function getJson<T>(baseUrl: string, path: string): Promise<T> {
  const url = `${baseUrl}${path}`;
  const response = await fetch(url, {
    headers: { Accept: 'application/json', ...internalApiHeaders() },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`GET ${url} failed with ${response.status}`);
  }

  return (await response.json()) as T;
}

function animePath({ search, sort, genreId, page, limit }: CatalogQuery) {
  const params = new URLSearchParams({ ...API_SORT[sort], page: String(page), limit: String(limit) });
  // The rankings only hold titles someone has rated.
  if (sort === 'rating') params.set('rated', 'true');
  if (search) params.set('search', search);
  if (genreId) params.set('genreId', String(genreId));
  return `/anime?${params}`;
}

function toListItem(entry: Anime): Anime {
  return {
    id: entry.id,
    title: entry.title,
    coverImageUrl: entry.coverImageUrl ?? null,
    releaseYear: entry.releaseYear ?? null,
    status: entry.status,
    hasDub: entry.hasDub,
    format: entry.format ?? null,
    episodes: entry.episodes ?? null,
    avgSubRating: entry.avgSubRating ?? null,
    avgDubRating: entry.avgDubRating ?? null,
    totalVotes: entry.totalVotes,
    genres: entry.genres ?? [],
    description: excerpt(entry.description),
  };
}

function warnFallback(baseUrl: string | null, error?: unknown) {
  // Keep pages rendering if the API is down, but make the fallback visible in logs
  // instead of silently showing demo titles.
  if (baseUrl) {
    console.warn(`[catalog] Could not load the catalog from ${baseUrl}; serving the bundled demo catalog.`, error);
  } else {
    console.warn('[catalog] API_URL / NEXT_PUBLIC_API_URL is not set; serving the bundled demo catalog.');
  }
}

/** One page of the catalogue, or null when the API cannot be reached. */
export async function loadCatalogPage(query: CatalogQuery): Promise<CatalogPage | null> {
  const baseUrl = resolveServerApiUrl();
  if (!baseUrl) {
    warnFallback(null);
    return null;
  }

  try {
    let result = await getJson<PaginatedAnime>(baseUrl, animePath(query));
    // A page past the end (an old link, a shrunken search) shows the last page instead.
    if (result.items.length === 0 && result.pagination.total > 0 && query.page > result.pagination.pages) {
      result = await getJson<PaginatedAnime>(baseUrl, animePath({ ...query, page: result.pagination.pages }));
    }

    return {
      items: result.items.map(toListItem),
      page: result.pagination.page,
      total: result.pagination.total,
      pages: result.pagination.pages,
    };
  } catch (error) {
    warnFallback(baseUrl, error);
    return null;
  }
}

export async function loadGenres(): Promise<Genre[] | null> {
  if (genreCache && genreCache.expiresAt > Date.now()) {
    return genreCache.genres;
  }

  const baseUrl = resolveServerApiUrl();
  if (!baseUrl) {
    return null;
  }

  try {
    const { items } = await getJson<{ items: Genre[] }>(baseUrl, '/anime/genres');
    genreCache = { expiresAt: Date.now() + CACHE_TTL_MS, genres: items };
    return items;
  } catch {
    return genreCache?.genres ?? null;
  }
}

/**
 * Candidates for the work the home page hangs: the most-rated titles first, then the
 * most popular, so the wall is never empty before anyone has rated anything.
 */
export async function loadFeaturedCandidates(): Promise<Anime[] | null> {
  if (featuredCache && featuredCache.expiresAt > Date.now()) {
    return featuredCache.items;
  }

  const baseUrl = resolveServerApiUrl();
  if (!baseUrl) {
    return null;
  }

  try {
    const query = { search: '', genreId: null, page: 1, limit: FEATURED_CANDIDATES };
    const [rated, popular] = await Promise.all([
      getJson<PaginatedAnime>(baseUrl, `${animePath({ ...query, sort: 'votes' })}&rated=true`),
      getJson<PaginatedAnime>(baseUrl, animePath({ ...query, sort: 'popular' })),
    ]);
    const seen = new Set<string>();
    const items = [...rated.items, ...popular.items]
      .filter((entry) => !seen.has(entry.id) && seen.add(entry.id))
      .map(toListItem);
    featuredCache = { expiresAt: Date.now() + CACHE_TTL_MS, items };
    return items;
  } catch {
    return featuredCache?.items ?? null;
  }
}

export { fallbackCatalogItems, fallbackGenreOptions };

// The featured wall label quotes the opening of the synopsis, cut at a word boundary.
function excerpt(description: string | null | undefined, limit = 260) {
  if (!description) {
    return null;
  }

  const text = description.replace(/\s+/g, ' ').trim();
  if (text.length <= limit) {
    return text;
  }

  const cut = text.slice(0, limit);
  return `${cut.slice(0, cut.lastIndexOf(' '))}…`;
}
