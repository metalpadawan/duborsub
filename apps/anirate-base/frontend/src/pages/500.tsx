import Head from 'next/head';
import { Masthead, SignedOutLinks } from '@/components/collection/Masthead';
import { Vacant } from '@/components/collection/Vacant';
import type { ZeroJsPageConfig } from '@/lib/catalog-view';

export const config: ZeroJsPageConfig = {
  unstable_runtimeJS: false,
};

// Shown when the catalogue cannot be reached, instead of demo titles passed off as real.
export default function ServerErrorPage() {
  return (
    <>
      <Head>
        <title>Temporarily unavailable · AniRate</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="robots" content="noindex" />
      </Head>
      <Masthead auth={<SignedOutLinks />} />
      <Vacant title="The collection is not answering." body="Something on our side is down for a moment. Give it a minute and reload the page." />
    </>
  );
}
