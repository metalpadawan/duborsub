import { Head, Html, Main, NextScript } from 'next/document';
import { IMAGE_FALLBACK_SCRIPT } from '@/lib/image-fallback';

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <meta name="theme-color" content="#f3f3f1" />
        {/* In the head, so it is listening before the first cover can fail. */}
        <script dangerouslySetInnerHTML={{ __html: IMAGE_FALLBACK_SCRIPT }} />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
