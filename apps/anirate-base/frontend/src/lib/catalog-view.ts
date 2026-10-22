import type { Anime } from '@/lib/api';

// Next types page config narrowly; this keeps the zero-JS flag type-checked.
export type ZeroJsPageConfig = { unstable_runtimeJS: false; runtime?: 'nodejs' };

// 'relevance' only applies to a search, where it is the default order; browsing
// starts on 'popular'. 'rating' is the rankings: rated titles only.
export type SortKey = 'relevance' | 'popular' | 'title' | 'rating' | 'votes' | 'year';

export const PAGE_SIZE = 20;

export const sortLabels: Record<SortKey, string> = {
  relevance: 'Best match',
  popular: 'Popular',
  title: 'A-Z',
  rating: 'Top Rated',
  votes: 'Most Voted',
  year: 'Newest',
};

export type HomeProps = {
  search: string;
  sort: SortKey;
  genre: string;
  genres: string[];
  items: Anime[];
  featured: Anime | null;
  page: number;
  totalItems: number;
  totalPages: number;
};

export function defaultSortFor(search: string): SortKey {
  return search ? 'relevance' : 'popular';
}

export function getSingleQueryValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? '' : value ?? '';
}

export function isSortKey(value: string): value is SortKey {
  return ['relevance', 'popular', 'title', 'rating', 'votes', 'year'].includes(value);
}

export function parseCatalogPage(value: string) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return 1;
  }

  return Math.max(1, Math.floor(parsed));
}
