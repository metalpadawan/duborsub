import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'My ratings',
  robots: { index: false },
};

export default function MyRatingsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
