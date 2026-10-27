import { internalApiHeaders, resolveServerApiUrl } from '@/lib/server/api-base';

// Each sitemap file holds at most this many titles (the protocol allows 50,000).
export const SITEMAP_CHUNK = 10_000;

export type SitemapEntry = { id: string; updatedAt: string };

/** One chunk of the catalogue's ids, or null when the API cannot be reached. */
export async function loadSitemapChunk(chunk: number): Promise<{ items: SitemapEntry[]; total: number } | null> {
  const baseUrl = resolveServerApiUrl();
  if (!baseUrl) {
    return null;
  }

  try {
    const response = await fetch(`${baseUrl}/anime/sitemap?page=${chunk + 1}&size=${SITEMAP_CHUNK}`, {
      headers: { Accept: 'application/json', ...internalApiHeaders() },
      signal: AbortSignal.timeout(15_000),
    });
    return response.ok ? ((await response.json()) as { items: SitemapEntry[]; total: number }) : null;
  } catch {
    return null;
  }
}
