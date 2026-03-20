// RootLayout is the one place where every page gets global CSS and client providers.
import type { Metadata } from 'next';
import './globals.css';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: 'AniRate - Sub vs Dub',
  description: 'Community ratings for anime sub and dub versions',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
