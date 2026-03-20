'use client';

// ForgotPasswordPage mirrors a production reset request flow, but the local
// in-memory backend exposes a debug token so the feature can still be tested.
import Link from 'next/link';
import { useState } from 'react';
import { AuthLayout } from '@/components/AuthLayout';
import { authApi } from '@/lib/api';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);

    try {
      const response = await authApi.forgotPassword(email);
      const token = response.data?.debugToken;
      // In local development we show the token directly because no SMTP service is configured.
      setMessage(
        token
          ? `Reset token for local testing: ${token}`
          : 'If that email exists, a reset link has been sent.',
      );
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Unable to start password reset');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout title="Reset your password" subtitle="We will generate a reset token for local testing">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {message ? (
          <div
            className="text-sm px-3 py-2 rounded-lg"
            style={{
              background: 'rgba(16,185,129,0.12)',
              color: '#34d399',
              border: '1px solid rgba(16,185,129,0.25)',
            }}
          >
            {message}
          </div>
        ) : null}

        {error ? (
          <div
            className="text-sm px-3 py-2 rounded-lg"
            style={{
              background: 'rgba(239,68,68,0.1)',
              color: '#ef4444',
              border: '1px solid rgba(239,68,68,0.2)',
            }}
          >
            {error}
          </div>
        ) : null}

        <div>
          <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-3)' }}>
            Email
          </label>
          <input
            type="email"
            className="input"
            required
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>

        <button type="submit" className="btn-primary w-full py-2.5" disabled={loading}>
          {loading ? 'Generating token...' : 'Generate reset token'}
        </button>

        <p className="text-center text-sm" style={{ color: 'var(--text-3)' }}>
          Back to{' '}
          <Link href="/login" style={{ color: 'var(--accent)' }}>
            Sign in
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
}
