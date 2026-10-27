import type { Anime } from '@/lib/api';
import { PAGE_SIZE, type HomeProps, type SortKey } from '@/lib/catalog-view';
import {
  fallbackCatalogItems,
  fallbackGenreOptions,
  loadCatalogPage,
  loadFeaturedCandidates,
  loadGenres,
} from '@/lib/server/catalog-source';
import { resolveServerApiUrl } from '@/lib/server/api-base';

// Thrown when the API is configured but did not answer. A statically generated page
// keeps serving its last good copy; a search page shows the error page. Demo titles
// are never passed off as the real catalogue.
export class CatalogUnavailableError extends Error {
  constructor() {
    super('The catalogue API did not answer');
  }
}

// The bundled demo catalogue stands in only when no API is configured at all, or
// while building without a backend running (CI), where the page is regenerated with
// real data on its first request.
function mayUseDemoCatalogue() {
  return !resolveServerApiUrl() || process.env.NEXT_PHASE === 'phase-production-build';
}

export async function loadCatalogPageProps({
  search = '',
  sort = 'popular',
  genre = '',
  page = 1,
}: {
  search?: string;
  sort?: SortKey;
  genre?: string;
  page?: number;
}): Promise<HomeProps> {
  const normalizedSearch = search.trim();
  // "Best match" only means something for a search.
  const normalizedSort: SortKey = sort === 'relevance' && !normalizedSearch ? 'popular' : sort;
  const requestedPage = Math.max(1, Math.floor(page));

  const [genres, featuredCandidates] = await Promise.all([loadGenres(), loadFeaturedCandidates()]);
  const matchedGenre = genres?.find((entry) => entry.name === genre) ?? null;
  const catalogPage = genres
    ? await loadCatalogPage({
        search: normalizedSearch,
        sort: normalizedSort,
        genreId: matchedGenre?.id ?? null,
        page: requestedPage,
        limit: PAGE_SIZE,
      })
    : null;

  if (!genres || !catalogPage) {
    if (!mayUseDemoCatalogue()) {
      throw new CatalogUnavailableError();
    }
    return fallbackProps({ search: normalizedSearch, sort: normalizedSort, genre, page: requestedPage });
  }

  return {
    search: normalizedSearch,
    sort: normalizedSort,
    genre: matchedGenre?.name ?? '',
    genres: ['All', ...genres.map((entry) => entry.name)],
    items: catalogPage.items,
    featured: pickFeatured(featuredCandidates ?? catalogPage.items),
    page: catalogPage.page,
    totalItems: catalogPage.total,
    totalPages: catalogPage.pages,
    isDemo: false,
  };
}

// The hero has to prove the mechanism, so it hangs the title with the most complete
// sub/dub comparison; cover art breaks ties, then the number of ratings. Candidates
// arrive most-rated first, then most popular, and the sort is stable, so before
// anything is rated the wall shows the most popular title with a cover. Its label
// then says plainly that it is unrated rather than inventing a score.
function pickFeatured(catalogItems: Anime[]) {
  const completeness = (anime: Anime) => Number(anime.avgSubRating != null) + Number(anime.avgDubRating != null);

  return (
    [...catalogItems].sort(
      (left, right) =>
        completeness(right) - completeness(left) ||
        Number(Boolean(right.coverImageUrl)) - Number(Boolean(left.coverImageUrl)) ||
        right.totalVotes - left.totalVotes,
    )[0] ?? null
  );
}

// Without the API the pages still render, from the small bundled demo catalogue.
function fallbackProps({ search, sort, genre, page }: { search: string; sort: SortKey; genre: string; page: number }): HomeProps {
  const normalizedGenre = fallbackGenreOptions.includes(genre) && genre !== 'All' ? genre : '';
  const needle = search.toLowerCase();
  const filteredItems = fallbackCatalogItems
    .filter((anime) => (needle ? anime.title.toLowerCase().includes(needle) : true))
    .filter((anime) => (sort === 'rating' ? anime.totalVotes > 0 : true))
    .filter((anime) => (normalizedGenre ? anime.genres.some((entry) => entry.name === normalizedGenre) : true))
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
  const totalPages = Math.max(1, Math.ceil(filteredItems.length / PAGE_SIZE));
  const normalizedPage = Math.min(page, totalPages);
  const startIndex = (normalizedPage - 1) * PAGE_SIZE;

  return {
    search,
    sort,
    genre: normalizedGenre,
    genres: fallbackGenreOptions,
    items: filteredItems.slice(startIndex, startIndex + PAGE_SIZE),
    featured: pickFeatured(fallbackCatalogItems),
    page: normalizedPage,
    totalItems: filteredItems.length,
    totalPages,
    isDemo: true,
  };
}
