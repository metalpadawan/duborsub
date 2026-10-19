import type { Anime, PaginatedAnime } from '@/lib/api';
import { catalogItems as fallbackCatalogItems, genreOptions as fallbackGenreOptions } from '@/lib/catalog-data';

// The catalog is read through the public API, so the frontend works wherever the
// backend is deployed instead of depending on the backend's private data file.
const API_PAGE_LIMIT = 50;
const CACHE_TTL_MS = 60_000;
const REQUEST_TIMEOUT_MS = 5_000;

let catalogCache: { expiresAt: number; items: Anime[] } | null = null;

function resolveServerApiUrl() {
  // API_URL lets server-side rendering use an internal address; the browser-facing
  // URL is the fallback, then the local backend during development.
  const configured = process.env.API_URL?.trim() || process.env.NEXT_PUBLIC_API_URL?.trim();
  if (configured) {
    return configured.replace(/\/$/, '');
  }

  return process.env.NODE_ENV === 'production' ? null : 'http://localhost:4000/api/v1';
}

async function fetchAnimePage(baseUrl: string, page: number): Promise<PaginatedAnime> {
  const url = `${baseUrl}/anime?sortBy=title&order=asc&limit=${API_PAGE_LIMIT}&page=${page}`;
  const response = await fetch(url, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`GET ${url} failed with ${response.status}`);
  }

  return (await response.json()) as PaginatedAnime;
}

export async function loadCatalogItems(): Promise<Anime[]> {
  if (catalogCache && catalogCache.expiresAt > Date.now()) {
    return catalogCache.items;
  }

  const baseUrl = resolveServerApiUrl();
  if (!baseUrl) {
    console.warn('[catalog] API_URL / NEXT_PUBLIC_API_URL is not set; serving the bundled demo catalog.');
    return fallbackCatalogItems;
  }

  try {
    const firstPage = await fetchAnimePage(baseUrl, 1);
    const remainingPages = await Promise.all(
      Array.from({ length: Math.max(0, firstPage.pagination.pages - 1) }, (_, index) =>
        fetchAnimePage(baseUrl, index + 2),
      ),
    );

    const items = [firstPage, ...remainingPages].flatMap((page) =>
      page.items.map((entry) => ({
        id: entry.id,
        title: entry.title,
        coverImageUrl: entry.coverImageUrl ?? null,
        releaseYear: entry.releaseYear ?? null,
        status: entry.status,
        hasDub: entry.hasDub,
        avgSubRating: entry.avgSubRating ?? null,
        avgDubRating: entry.avgDubRating ?? null,
        totalVotes: entry.totalVotes,
        genres: entry.genres ?? [],
      })),
    );

    if (items.length === 0) {
      return fallbackCatalogItems;
    }

    catalogCache = { expiresAt: Date.now() + CACHE_TTL_MS, items };
    return items;
  } catch (error) {
    // Keep pages rendering if the API is down, but make the fallback visible in logs
    // instead of silently showing demo titles.
    console.warn(`[catalog] Could not load the catalog from ${baseUrl}; serving the bundled demo catalog.`, error);
    return catalogCache?.items ?? fallbackCatalogItems;
  }
}

export function getGenreOptions(items: Anime[]) {
  const genres = Array.from(new Set(items.flatMap((anime) => anime.genres.map((genre) => genre.name)))).sort();
  return genres.length ? ['All', ...genres] : fallbackGenreOptions;
}
