// RootLayout gives App Router pages the shared document shell, the Archivo
// variable font, and the one design-system stylesheet both routers use.
import type { Metadata } from 'next';
import { archivo } from '@/lib/fonts';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'AniRate — Two versions. Two scores.',
    template: '%s · AniRate',
  },
  description: 'AniRate rates the subtitled and dubbed release of every anime separately, so you can choose the version worth watching.',
  icons: { icon: '/favicon.svg' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={archivo.variable}>
      <body className="site">
        {children}
      </body>
    </html>
  );
}
