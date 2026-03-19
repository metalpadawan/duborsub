// src/app/forgot-password/page.tsx
'use client';
import { useState } from 'react';
import Link from 'next/link';
import { authApi } from '@/lib/api';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await authApi.forgotPassword(email);
      setSent(true);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell title="Forgot password" subtitle="We'll email you a reset link">
      {sent ? (
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>📬</div>
          <p style={{ color: 'var(--text-2)', fontSize: 14, marginBottom: 20, lineHeight: 1.6 }}>
            If an account exists for <strong style={{ color: 'var(--text-1)' }}>{email}</strong>,
            a reset link has been sent. Check your inbox (and spam folder).
          </p>
          <Link href="/login" style={{ color: 'var(--accent)', fontSize: 14 }}>Back to sign in</Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {error && (
            <div style={{ fontSize: 13, padding: '8px 12px', borderRadius: 8, background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }}>
              {error}
            </div>
          )}
          <div>
            <label style={{ fontSize: 12, color: 'var(--text-3)', display: 'block', marginBottom: 6 }}>
              Email address
            </label>
            <input
              type="email" className="input" required
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <button type="submit" className="btn-primary" style={{ padding: '10px 0' }} disabled={loading}>
            {loading ? 'Sending...' : 'Send reset link'}
          </button>
          <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--text-3)' }}>
            <Link href="/login" style={{ color: 'var(--accent)' }}>Back to sign in</Link>
          </p>
        </form>
      )}
    </AuthShell>
  );
}

// ─────────────────────────────────────────────────────────────
// src/app/reset-password/page.tsx
// ─────────────────────────────────────────────────────────────
'use client';
import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { authApi } from '@/lib/api';

export function ResetPasswordPage() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get('token') ?? '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const passwordsMatch = password === confirm;
  const strongEnough = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&_\-#]).{8,}$/.test(password);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordsMatch) return setError('Passwords do not match');
    if (!strongEnough) return setError('Password does not meet requirements');

    setLoading(true);
    setError('');
    try {
      await authApi.resetPassword(token, password);
      setDone(true);
      setTimeout(() => router.push('/login'), 3000);
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Invalid or expired reset link');
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <AuthShell title="Invalid link" subtitle="">
        <p style={{ color: 'var(--text-3)', fontSize: 14, textAlign: 'center', marginBottom: 16 }}>
          This reset link is missing a token. Please request a new one.
        </p>
        <Link href="/forgot-password" className="btn-primary" style={{ display: 'block', textAlign: 'center' }}>
          Request new link
        </Link>
      </AuthShell>
    );
  }

  if (done) {
    return (
      <AuthShell title="Password updated" subtitle="Redirecting to sign in...">
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>✓</div>
          <p style={{ color: 'var(--text-2)', fontSize: 14 }}>
            Your password has been changed. You can now sign in with your new password.
          </p>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="New password" subtitle="Choose a strong password">
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {error && (
          <div style={{ fontSize: 13, padding: '8px 12px', borderRadius: 8, background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }}>
            {error}
          </div>
        )}
        <div>
          <label style={{ fontSize: 12, color: 'var(--text-3)', display: 'block', marginBottom: 6 }}>
            New password
          </label>
          <input
            type="password" className="input" required
            minLength={8} autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <p style={{ fontSize: 11, color: strongEnough || !password ? 'var(--text-3)' : '#ef4444', marginTop: 4 }}>
            Min 8 chars · uppercase · lowercase · number · special character
          </p>
        </div>
        <div>
          <label style={{ fontSize: 12, color: 'var(--text-3)', display: 'block', marginBottom: 6 }}>
            Confirm password
          </label>
          <input
            type="password" className="input" required
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            style={{ borderColor: confirm && !passwordsMatch ? 'rgba(239,68,68,0.5)' : undefined }}
          />
        </div>
        <button
          type="submit"
          className="btn-primary"
          style={{ padding: '10px 0' }}
          disabled={loading || !password || !passwordsMatch || !strongEnough}
        >
          {loading ? 'Updating...' : 'Set new password'}
        </button>
      </form>
    </AuthShell>
  );
}

export default ResetPasswordPage;

// ─────────────────────────────────────────────────────────────
// Shared auth shell (same as login page uses — co-locate or move to components/)
function AuthShell({ title, subtitle, children }: {
  title: string; subtitle: string; children: React.ReactNode;
}) {
  return (
    <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, background: 'var(--bg-base)' }}>
      <div style={{ width: '100%', maxWidth: 380 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <Link href="/" style={{ fontSize: 24, fontWeight: 700, color: 'var(--accent)', textDecoration: 'none' }}>AniRate</Link>
          <h1 style={{ fontSize: 20, fontWeight: 600, color: 'var(--text-1)', margin: '16px 0 4px' }}>{title}</h1>
          {subtitle && <p style={{ fontSize: 14, color: 'var(--text-3)' }}>{subtitle}</p>}
        </div>
        <div className="card" style={{ padding: 24 }}>{children}</div>
      </div>
    </main>
  );
}
