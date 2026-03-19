'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/auth.store';

export function SiteHeader() {
  const router = useRouter();
  const { user, logout } = useAuthStore();

  const handleLogout = async () => {
    await logout();
    router.push('/');
  };

  return (
    <header className="border-b" style={{ borderColor: 'var(--border)', background: 'var(--bg-surface)' }}>
      <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-2xl font-bold" style={{ color: 'var(--accent)' }}>
            AniRate
          </span>
          <span
            className="text-sm px-2 py-0.5 rounded-full"
            style={{ background: 'var(--bg-hover)', color: 'var(--text-3)' }}
          >
            Sub vs Dub
          </span>
        </Link>

        <nav className="flex items-center gap-3">
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
