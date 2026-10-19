// AuthLayout gives all auth pages a consistent centered shell and branding.
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
    <main
      className="min-h-screen flex items-center justify-center px-4 py-10"
      style={{
        background:
          'radial-gradient(circle at 18% 0%, color-mix(in oklch, var(--accent-alt) 22%, transparent), transparent 24rem), var(--bg-base)',
      }}
    >
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <Link href="/" className="inline-flex items-center justify-center gap-3">
            <span
              className="grid h-11 w-11 place-items-center rounded-xl text-sm font-black"
              style={{
                background: 'linear-gradient(135deg, var(--accent), var(--accent-alt))',
                color: 'var(--bg-base)',
              }}
            >
              AR
            </span>
            <span className="text-left">
              <span className="block text-2xl font-black leading-6" style={{ color: 'var(--text-1)' }}>
                AniRate
              </span>
              <span className="block text-xs uppercase tracking-[0.18em]" style={{ color: 'var(--text-3)' }}>
                sub/dub database
              </span>
            </span>
          </Link>
          <h1 className="text-2xl font-black mt-6 mb-1 tracking-[-0.03em]" style={{ color: 'var(--text-1)' }}>
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
