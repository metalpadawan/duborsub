import Head from 'next/head';
import { Masthead, SignedOutLinks } from '@/components/collection/Masthead';
import { Vacant } from '@/components/collection/Vacant';
import type { ZeroJsPageConfig } from '@/lib/catalog-view';

export const config: ZeroJsPageConfig = {
  unstable_runtimeJS: false,
};

export default function NotFoundPage() {
  return (
    <>
      <Head>
        <title>Not in the collection · AniRate</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <Masthead auth={<SignedOutLinks />} />
      <Vacant />
    </>
  );
}
