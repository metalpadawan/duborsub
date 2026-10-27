import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Forgot your password',
  robots: { index: false },
};

export default function ForgotPasswordLayout({ children }: { children: React.ReactNode }) {
  return children;
}
