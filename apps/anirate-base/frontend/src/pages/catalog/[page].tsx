import type { GetStaticPaths, GetStaticProps } from 'next';
import { parseCatalogPage, type HomeProps } from '@/lib/catalog-view';
import HomePage from '../index';

export default HomePage;

export const getStaticPaths: GetStaticPaths = async () => {
  const { loadCatalogPageProps } = await import('@/lib/server/catalog-page-props');
  const firstPage = await loadCatalogPageProps({});
  const prebuiltPageCount = Math.min(Math.max(0, firstPage.totalPages - 1), 8);
  const paths = Array.from({ length: prebuiltPageCount }, (_, index) => ({
    params: { page: String(index + 2) },
  }));

  return {
    paths,
    fallback: 'blocking',
  };
};

export const getStaticProps: GetStaticProps<HomeProps> = async ({ params }) => {
  const { loadCatalogPageProps } = await import('@/lib/server/catalog-page-props');
  const page = parseCatalogPage(String(params?.page ?? '1'));

  if (page < 2) {
    return {
      redirect: {
        destination: '/',
        permanent: false,
      },
    };
  }

  const props = await loadCatalogPageProps({ page });

  if (page > props.totalPages) {
    return {
      notFound: true,
      revalidate: 60,
    };
  }

  return {
    props,
    revalidate: 60,
  };
};
