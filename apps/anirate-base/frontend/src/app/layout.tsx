// RootLayout gives App Router pages the shared document shell and global CSS.
import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'AniRate - Sub vs Dub',
  description: 'Community ratings for anime sub and dub versions',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
