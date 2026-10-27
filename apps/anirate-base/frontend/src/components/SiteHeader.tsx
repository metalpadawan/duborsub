'use client';

// SiteHeader is the masthead for React pages: same signage as the catalog, with
// the auth slot reflecting the signed-in user, and a reminder to confirm the email
// address for members who have not yet.
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Masthead, SignedOutLinks } from '@/components/collection/Masthead';
import { authApi } from '@/lib/api';
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

  const menuLinks = user
    ? [{ href: '/my-ratings', label: 'My ratings' }, ...(user.role === 'admin' ? [{ href: '/admin', label: 'Admin' }] : [])]
    : [];

  return (
    <>
      <Masthead auth={auth} menuLinks={menuLinks} />
      {user && !user.emailVerified ? <ConfirmEmailReminder email={user.email} /> : null}
    </>
  );
}

function ConfirmEmailReminder({ email }: { email: string }) {
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');

  const resend = async () => {
    setState('sending');
    try {
      await authApi.resendVerification();
      setState('sent');
    } catch {
      setState('error');
    }
  };

  return (
    <div className="reminder" role="status">
      <div className="wrap reminder__inner">
        <p>
          {state === 'sent'
            ? `A fresh link is on its way to ${email}.`
            : state === 'error'
              ? 'The link could not be sent just now. Try again in a few minutes.'
              : `Confirm your email to rate, post notes and report dubs. The link went to ${email}.`}
        </p>
        {state !== 'sent' ? (
          <button type="button" className="text-action reminder__action" onClick={resend} disabled={state === 'sending'}>
            {state === 'sending' ? 'Sending…' : 'Send the link again'}
          </button>
        ) : null}
      </div>
    </div>
  );
}
