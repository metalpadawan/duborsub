// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { catalogItems as fallbackCatalogItems } from '@/lib/catalog-data';

function animeEntry(id: string) {
  return {
    id,
    title: `Title ${id}`,
    coverImageUrl: null,
    releaseYear: 2024,
    status: 'airing',
    hasDub: false,
    avgSubRating: null,
    avgDubRating: null,
    totalVotes: 0,
    genres: [{ id: 1, name: 'Action' }],
  };
}

function pageResponse(page: number, pages: number, ids: string[]) {
  return new Response(
    JSON.stringify({ items: ids.map(animeEntry), pagination: { page, limit: 50, total: ids.length, pages } }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
}

describe('loadCatalogItems', () => {
  beforeEach(() => {
    // Each test needs a fresh module so the in-memory catalog cache starts empty.
    vi.resetModules();
    vi.stubEnv('API_URL', 'http://api.test/api/v1');
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('collects every page of the catalog from the API', async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const page = Number(new URL(String(input)).searchParams.get('page'));
      return pageResponse(page, 2, page === 1 ? ['anilist-1', 'anilist-2'] : ['anilist-3']);
    });
    vi.stubGlobal('fetch', fetchMock);
    const { loadCatalogItems } = await import('./catalog-source');

    const items = await loadCatalogItems();

    expect(items.map((item) => item.id)).toEqual(['anilist-1', 'anilist-2', 'anilist-3']);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[0][0])).toContain('http://api.test/api/v1/anime?');

    await loadCatalogItems();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('falls back to the bundled demo catalog and logs it when the API is unreachable', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new Error('connect ECONNREFUSED'))));
    const { loadCatalogItems } = await import('./catalog-source');

    await expect(loadCatalogItems()).resolves.toEqual(fallbackCatalogItems);
    expect(console.warn).toHaveBeenCalled();
  });
});
