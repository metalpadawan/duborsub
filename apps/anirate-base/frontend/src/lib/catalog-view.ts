import type { Anime } from '@/lib/api';

export type SortKey = 'title' | 'rating' | 'votes' | 'year';

export const PAGE_SIZE = 4;

export const sortLabels: Record<SortKey, string> = {
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
  page: number;
  totalItems: number;
  totalPages: number;
};

export function getSingleQueryValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? '' : value ?? '';
}

export function isSortKey(value: string): value is SortKey {
  return value === 'title' || value === 'rating' || value === 'votes' || value === 'year';
}

export function parseCatalogPage(value: string) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return 1;
  }

  return Math.max(1, Math.floor(parsed));
}
