'use client';

// SiteHeader is shared across the main catalog and detail views.
// It reflects auth state and gives users a reliable way back to the home page.
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/auth.store';

export function SiteHeader() {
  const router = useRouter();
  const { user, logout } = useAuthStore();

  const handleLogout = async () => {
    // After logout we redirect home so the UI resets to a predictable public state.
    await logout();
    router.push('/');
  };

  return (
    <header
      className="sticky top-0 z-30 border-b backdrop-blur"
      style={{
        borderColor: 'var(--border)',
        background: 'color-mix(in oklch, var(--bg-surface) 88%, transparent)',
      }}
    >
      <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-3 min-w-0">
          <span
            className="grid h-10 w-10 shrink-0 place-items-center rounded-lg text-sm font-black"
            style={{
              background: 'linear-gradient(135deg, var(--accent), var(--accent-alt))',
              color: 'var(--bg-base)',
            }}
          >
            AR
          </span>
          <span className="min-w-0">
            <span className="block text-xl font-black leading-5" style={{ color: 'var(--text-1)' }}>
              AniRate
            </span>
            <span className="block text-xs uppercase tracking-[0.18em]" style={{ color: 'var(--text-3)' }}>
              sub/dub database
            </span>
          </span>
        </Link>

        <nav className="flex items-center gap-3">
          <Link href="/catalog/search?sort=rating" className="btn-ghost text-sm hidden sm:inline-flex">
            Rankings
          </Link>
          {user ? (
            <>
              <span className="text-sm" style={{ color: 'var(--text-2)' }}>
                {user.username}
              </span>
              <button className="btn-ghost text-sm" onClick={handleLogout}>
                Sign out
              </button>
            </>
          ) : (
            <>
              <Link href="/login" className="btn-ghost text-sm">
                Sign in
              </Link>
              <Link href="/register" className="btn-primary text-sm">
                Join
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
