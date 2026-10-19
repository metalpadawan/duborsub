import type { GetServerSideProps } from 'next';
import { getSingleQueryValue, isSortKey, parseCatalogPage, type HomeProps } from '@/lib/catalog-view';
import HomePage from '../index';

export default HomePage;

export const getServerSideProps: GetServerSideProps<HomeProps> = async ({ query }) => {
  const { loadCatalogPageProps } = await import('@/lib/server/catalog-page-props');
  const search = getSingleQueryValue(query.q);
  const sortCandidate = getSingleQueryValue(query.sort);
  const sort = isSortKey(sortCandidate) ? sortCandidate : 'title';
  const genre = getSingleQueryValue(query.genre);
  const page = parseCatalogPage(getSingleQueryValue(query.page));

  return {
    props: await loadCatalogPageProps({ search, sort, genre, page }),
  };
};
