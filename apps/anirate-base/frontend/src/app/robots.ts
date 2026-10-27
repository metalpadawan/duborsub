// Crawlers may read the catalogue and title pages, not the private or one-off pages.
import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/site';
import { loadSitemapChunk, SITEMAP_CHUNK } from '@/lib/server/sitemap-source';

export const revalidate = 86_400;

export default async function robots(): Promise<MetadataRoute.Robots> {
  const first = await loadSitemapChunk(0);
  const chunks = Math.max(1, Math.ceil((first?.total ?? 0) / SITEMAP_CHUNK));

  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/admin', '/my-ratings', '/verify-email', '/reset-password', '/forgot-password'],
    },
    sitemap: Array.from({ length: chunks }, (_, id) => `${SITE_URL}/sitemap/${id}.xml`),
  };
}
