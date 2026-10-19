import type { Anime } from '@/lib/api';
import { PAGE_SIZE, type HomeProps, type SortKey } from '@/lib/catalog-view';
import { getGenreOptions, loadCatalogItems } from '@/lib/server/catalog-source';

export async function loadCatalogPageProps({
  search = '',
  sort = 'title',
  genre = '',
  page = 1,
}: {
  search?: string;
  sort?: SortKey;
  genre?: string;
  page?: number;
}): Promise<HomeProps> {
  const catalogItems = await loadCatalogItems();
  const genreOptions = getGenreOptions(catalogItems);
  const normalizedSearch = search.trim();
  const normalizedGenre = genreOptions.includes(genre) && genre !== 'All' ? genre : '';
  const filteredItems = getFilteredItems({ catalogItems, search: normalizedSearch, sort, genre: normalizedGenre });
  const totalItems = filteredItems.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
  const normalizedPage = Math.min(Math.max(1, Math.floor(page)), totalPages);
  const startIndex = (normalizedPage - 1) * PAGE_SIZE;

  return {
    search: normalizedSearch,
    sort,
    genre: normalizedGenre,
    genres: genreOptions,
    items: filteredItems.slice(startIndex, startIndex + PAGE_SIZE),
    page: normalizedPage,
    totalItems,
    totalPages,
  };
}

function getFilteredItems({
  catalogItems,
  search,
  sort,
  genre,
}: {
  catalogItems: Anime[];
  search: string;
  sort: SortKey;
  genre: string;
}) {
  const needle = search.toLowerCase();

  return catalogItems
    .filter((anime) => (needle ? anime.title.toLowerCase().includes(needle) : true))
    .filter((anime) => (genre ? anime.genres.some((entry) => entry.name === genre) : true))
    .sort((left, right) => {
      if (sort === 'rating') {
        return (right.avgSubRating ?? 0) - (left.avgSubRating ?? 0);
      }

      if (sort === 'votes') {
        return right.totalVotes - left.totalVotes;
      }

      if (sort === 'year') {
        return (right.releaseYear ?? 0) - (left.releaseYear ?? 0);
      }

      return left.title.localeCompare(right.title);
    });
}
