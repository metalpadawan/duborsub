// The Pages Router shares the App Router's design system: same stylesheet, same font.
import type { AppProps } from 'next/app';
import { archivo } from '@/lib/fonts';
import '@/app/globals.css';

export default function App({ Component, pageProps }: AppProps) {
  return (
    <div className={`${archivo.variable} site`}>
      <Component {...pageProps} />
    </div>
  );
}
