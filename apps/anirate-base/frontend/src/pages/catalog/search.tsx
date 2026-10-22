import type { GetServerSideProps } from 'next';
import { defaultSortFor, getSingleQueryValue, isSortKey, parseCatalogPage, type HomeProps, type ZeroJsPageConfig } from '@/lib/catalog-view';
import HomePage from '../index';

export default HomePage;

// Same as the home page: server-rendered, no React runtime.
export const config: ZeroJsPageConfig = {
  unstable_runtimeJS: false,
};

export const getServerSideProps: GetServerSideProps<HomeProps> = async ({ query }) => {
  const { loadCatalogPageProps } = await import('@/lib/server/catalog-page-props');
  const search = getSingleQueryValue(query.q);
  const sortCandidate = getSingleQueryValue(query.sort);
  const sort = isSortKey(sortCandidate) ? sortCandidate : defaultSortFor(search.trim());
  const genre = getSingleQueryValue(query.genre);
  const page = parseCatalogPage(getSingleQueryValue(query.page));

  return {
    props: await loadCatalogPageProps({ search, sort, genre, page }),
  };
};
