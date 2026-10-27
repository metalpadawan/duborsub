// The work page is fetched on the server so its first frame already contains the
// hung work: that is what the catalogue thumbnail morphs into during the
// cross-document view transition. A missing work answers with a real 404.
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { fetchAnime } from '@/lib/server/anime-source';
import AnimeDetail from './AnimeDetail';

type Params = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id } = await params;
  const lookup = await fetchAnime(id);
  if (lookup.status !== 'found') {
    return { title: 'Not in the collection' };
  }

  const { anime } = lookup;
  const split =
    anime.avgSubRating != null || anime.avgDubRating != null
      ? ` Sub ${anime.avgSubRating?.toFixed(1) ?? '–'}, dub ${anime.avgDubRating?.toFixed(1) ?? '–'} out of 5.`
      : '';
  const description = `Sub or dub? Ratings for ${anime.title}, compared side by side.${split}`;
  const path = `/anime/${anime.id}`;

  // A shared link shows the cover; titles without one fall back to the site card.
  return {
    title: anime.title,
    description,
    alternates: { canonical: path },
    openGraph: {
      title: `${anime.title} · Sub or dub?`,
      description,
      url: path,
      ...(anime.coverImageUrl ? { images: [{ url: anime.coverImageUrl, alt: `Cover art for ${anime.title}` }] } : {}),
    },
    twitter: { card: anime.coverImageUrl ? 'summary' : 'summary_large_image' },
  };
}

export default async function AnimeDetailPage({ params }: Params) {
  const { id } = await params;
  const lookup = await fetchAnime(id);

  if (lookup.status === 'missing') {
    notFound();
  }

  // When the API is briefly unavailable the client view retries on its own.
  return <AnimeDetail animeId={id} initialAnime={lookup.status === 'found' ? lookup.anime : null} />;
}
