// Every title's page, in sitemaps of 10,000, so search engines can find all ~38,000.
// Regenerated daily; robots.ts lists each file.
import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/site';
import { loadSitemapChunk, SITEMAP_CHUNK } from '@/lib/server/sitemap-source';

export const revalidate = 86_400;

export async function generateSitemaps() {
  const first = await loadSitemapChunk(0);
  const chunks = Math.max(1, Math.ceil((first?.total ?? 0) / SITEMAP_CHUNK));
  return Array.from({ length: chunks }, (_, id) => ({ id }));
}

export default async function sitemap({ id }: { id: Promise<string> | number }): Promise<MetadataRoute.Sitemap> {
  const chunk = Number(await id);
  const result = await loadSitemapChunk(chunk);
  const titles: MetadataRoute.Sitemap = (result?.items ?? []).map((entry) => ({
    url: `${SITE_URL}/anime/${entry.id}`,
    lastModified: entry.updatedAt,
    changeFrequency: 'weekly',
  }));

  // The handful of standing pages ride along with the first chunk.
  return chunk === 0
    ? [
        { url: `${SITE_URL}/`, changeFrequency: 'daily', priority: 1 },
        { url: `${SITE_URL}/catalog/search?sort=rating`, changeFrequency: 'daily' },
        { url: `${SITE_URL}/request`, changeFrequency: 'monthly' },
        { url: `${SITE_URL}/privacy`, changeFrequency: 'yearly' },
        { url: `${SITE_URL}/terms`, changeFrequency: 'yearly' },
        ...titles,
      ]
    : titles;
}
