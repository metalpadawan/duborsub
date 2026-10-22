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

  return {
    title: lookup.anime.title,
    description: `Sub and dub ratings for ${lookup.anime.title}, compared side by side on AniRate.`,
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
