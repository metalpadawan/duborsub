import Link from 'next/link';

export function AuthLayout({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen flex items-center justify-center px-4" style={{ background: 'var(--bg-base)' }}>
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Link href="/" className="text-2xl font-bold" style={{ color: 'var(--accent)' }}>
            AniRate
          </Link>
          <h1 className="text-xl font-semibold mt-4 mb-1" style={{ color: 'var(--text-1)' }}>
            {title}
          </h1>
          <p className="text-sm" style={{ color: 'var(--text-3)' }}>
            {subtitle}
          </p>
        </div>
        <div className="card p-6">{children}</div>
      </div>
    </main>
  );
}
