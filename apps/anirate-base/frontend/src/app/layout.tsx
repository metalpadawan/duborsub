// RootLayout gives App Router pages the shared document shell, the Archivo
// variable font, and the one design-system stylesheet both routers use.
import type { Metadata } from 'next';
import { archivo } from '@/lib/fonts';
import { IMAGE_FALLBACK_SCRIPT } from '@/lib/image-fallback';
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from '@/lib/site';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'AniRate — Two versions. Two scores.',
    template: '%s · AniRate',
  },
  description: SITE_DESCRIPTION,
  metadataBase: new URL(SITE_URL),
  icons: { icon: '/favicon.svg' },
  // Link previews in chats and social posts; opengraph-image.tsx draws the image.
  openGraph: { siteName: SITE_NAME, type: 'website', locale: 'en_GB' },
  twitter: { card: 'summary_large_image' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={archivo.variable}>
      <body className="site">
        {/* First in the body, so it is listening before any cover can fail. */}
        <script dangerouslySetInnerHTML={{ __html: IMAGE_FALLBACK_SCRIPT }} />
        {children}
      </body>
    </html>
  );
}
