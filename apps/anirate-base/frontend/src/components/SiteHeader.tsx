'use client';

// SiteHeader is the masthead for React pages: same signage as the catalog, with
// the auth slot reflecting the signed-in user.
import { useRouter } from 'next/navigation';
import { Masthead, SignedOutLinks } from '@/components/collection/Masthead';
import { useAuthStore } from '@/lib/auth.store';

export function SiteHeader() {
  const router = useRouter();
  const { user, isLoading, logout } = useAuthStore();

  const handleLogout = async () => {
    // After logout we redirect home so the UI resets to a predictable public state.
    await logout();
    router.push('/');
  };

  let auth: React.ReactNode;
  if (isLoading) {
    // Hold the slot's width while the session is restored so nothing shifts.
    auth = <span style={{ display: 'inline-block', width: '7.5rem' }} aria-hidden="true" />;
  } else if (user) {
    auth = (
      <>
        {user.role === 'admin' ? (
          <a className="link hide-sm" href="/admin">
            Admin
          </a>
        ) : null}
        <a className="link masthead__user" href="/my-ratings" aria-label={`My ratings (signed in as ${user.username})`}>
          {user.username}
        </a>
        <button type="button" className="link" onClick={handleLogout}>
          Sign out
        </button>
      </>
    );
  } else {
    auth = <SignedOutLinks />;
  }

  return <Masthead auth={auth} />;
}
