// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
}

function pageResponse(page: number, pages: number, total: number, ids: string[]) {
  return jsonResponse({ items: ids.map(animeEntry), pagination: { page, limit: 20, total, pages } });
}

const query = { search: '', sort: 'title' as const, genreId: null, page: 1, limit: 20 };

describe('catalog source', () => {
  beforeEach(() => {
    // Each test needs a fresh module so the in-memory caches start empty.
    vi.resetModules();
    vi.stubEnv('API_URL', 'http://api.test/api/v1');
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('asks the API for just the requested page, with search, sort and genre', async () => {
    const fetchMock = vi.fn(async () => pageResponse(3, 9, 170, ['anilist-1']));
    vi.stubGlobal('fetch', fetchMock);
    const { loadCatalogPage } = await import('./catalog-source');

    const result = await loadCatalogPage({ ...query, search: 'titan', sort: 'relevance', genreId: 4, page: 3 });

    expect(result).toMatchObject({ page: 3, pages: 9, total: 170 });
    expect(result?.items.map((item) => item.id)).toEqual(['anilist-1']);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const url = new URL(String((fetchMock.mock.calls[0] as unknown[])[0]));
    expect(url.pathname).toBe('/api/v1/anime');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      sortBy: 'relevance',
      order: 'asc',
      page: '3',
      limit: '20',
      search: 'titan',
      genreId: '4',
    });
  });

  it('asks for rated titles only when ranking by rating', async () => {
    const fetchMock = vi.fn(async () => pageResponse(1, 1, 0, []));
    vi.stubGlobal('fetch', fetchMock);
    const { loadCatalogPage } = await import('./catalog-source');

    await loadCatalogPage({ ...query, sort: 'rating' });

    const url = new URL(String((fetchMock.mock.calls[0] as unknown[])[0]));
    expect(url.searchParams.get('sortBy')).toBe('rating');
    expect(url.searchParams.get('order')).toBe('desc');
    expect(url.searchParams.get('rated')).toBe('true');
  });

  it('shows the last page when asked for a page past the end', async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const page = Number(new URL(String(input)).searchParams.get('page'));
      return page === 2 ? pageResponse(2, 2, 25, ['anilist-9']) : pageResponse(page, 2, 25, []);
    });
    vi.stubGlobal('fetch', fetchMock);
    const { loadCatalogPage } = await import('./catalog-source');

    const result = await loadCatalogPage({ ...query, page: 40 });

    expect(result?.page).toBe(2);
    expect(result?.items.map((item) => item.id)).toEqual(['anilist-9']);
  });

  it('caches the genre list between pages', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ items: [{ id: 1, name: 'Action' }] }));
    vi.stubGlobal('fetch', fetchMock);
    const { loadGenres } = await import('./catalog-source');

    await expect(loadGenres()).resolves.toEqual([{ id: 1, name: 'Action' }]);
    await loadGenres();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('returns null and logs it when the API is unreachable, so pages fall back to the demo catalog', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new Error('connect ECONNREFUSED'))));
    const { loadCatalogPage } = await import('./catalog-source');

    await expect(loadCatalogPage(query)).resolves.toBeNull();
    expect(console.warn).toHaveBeenCalled();
  });
});
