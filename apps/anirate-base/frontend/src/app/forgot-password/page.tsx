'use client';

// ForgotPasswordPage starts a reset. With no email service connected locally, the
// backend can return the token (EXPOSE_RESET_TOKEN), which becomes a direct link.
import Link from 'next/link';
import { useState } from 'react';
import { AuthLayout, errorMessage } from '@/components/AuthLayout';
import { authApi } from '@/lib/api';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [debugToken, setDebugToken] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await authApi.forgotPassword(email);
      setDebugToken(response.data?.debugToken ?? null);
      setSent(true);
    } catch (err) {
      setError(errorMessage(err, 'We could not start a reset right now. Try again in a minute.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout title="Reset your password" subtitle="Enter the email on your account and we will send a reset link.">
      <form onSubmit={handleSubmit} className="form">
        {error ? (
          <div role="alert" className="notice notice--error">
            {error}
          </div>
        ) : null}

        {sent ? (
          <div role="status" className="notice notice--ok">
            If that email belongs to an account, a reset link is on its way.
            {debugToken ? (
              <>
                {' '}
                No email service is connected in local development, so here is the link directly:
                <p style={{ marginTop: '0.75rem' }}>
                  <Link className="link link--ruled" href={`/reset-password?token=${encodeURIComponent(debugToken)}`}>
                    Set a new password
                  </Link>
                </p>
              </>
            ) : null}
          </div>
        ) : null}

        <div className="field">
          <label htmlFor="email" className="field__label signage">
            Email
          </label>
          <input
            id="email"
            type="email"
            className="input"
            required
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>

        <button type="submit" className="btn btn--ink btn--block" disabled={loading}>
          {loading ? 'Sending…' : sent ? 'Send another link' : 'Send reset link'}
        </button>

        <p className="form__aside">
          Remembered it?{' '}
          <Link href="/login" className="link link--ruled link--klein">
            Back to sign in
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
}
