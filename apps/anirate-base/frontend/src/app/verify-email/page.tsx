'use client';

// The link emailed at sign-up lands here; confirming the address unlocks rating,
// notes and dub reports.
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useRef, useState } from 'react';
import { AuthLayout, errorMessage } from '@/components/AuthLayout';
import { authApi } from '@/lib/api';

export default function VerifyEmailPage() {
  return (
    <AuthLayout title="Confirm your email" subtitle="One click, and you can rate, post notes and report dubs.">
      <Suspense fallback={null}>
        <Confirm />
      </Suspense>
    </AuthLayout>
  );
}

function Confirm() {
  const token = useSearchParams()?.get('token') ?? '';
  const [state, setState] = useState<{ tone: 'idle' | 'ok' | 'error'; text: string }>({ tone: 'idle', text: 'Confirming…' });
  const started = useRef(false);

  useEffect(() => {
    // React's development double-render must not spend the single-use token twice.
    if (started.current) return;
    started.current = true;

    if (!token) {
      setState({ tone: 'error', text: 'This link is missing its token. Open the link from the email again.' });
      return;
    }

    authApi
      .verifyEmail(token)
      .then(() => setState({ tone: 'ok', text: 'Your email address is confirmed. Welcome in.' }))
      .catch((err) => setState({ tone: 'error', text: errorMessage(err, 'This link has expired or was already used.') }));
  }, [token]);

  return (
    <div className="form">
      <p role="status" className={state.tone === 'error' ? 'notice notice--error' : state.tone === 'ok' ? 'notice notice--ok' : 'muted'}>
        {state.text}
      </p>
      {state.tone === 'ok' ? (
        <Link className="btn btn--white" href="/">
          Go to the collection
        </Link>
      ) : null}
      {state.tone === 'error' ? (
        <p className="muted">
          Signed in? The reminder at the top of any page can send a fresh link. Otherwise <Link href="/login">sign in</Link> first.
        </p>
      ) : null}
    </div>
  );
}
