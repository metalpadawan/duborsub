'use client';
import { useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { authApi } from '@/lib/api';

function ResetForm() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get('token') ?? '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm]   = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [done, setDone]         = useState(false);

  const strongEnough = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&_\-#]).{8,}$/.test(password);
  const passwordsMatch = password === confirm;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!passwordsMatch) return setError('Passwords do not match');
    if (!strongEnough)   return setError('Password does not meet the requirements');
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
  }

  if (!token) return (
    <div style={{ textAlign: 'center' }}>
      <p style={{ color: 'var(--text-3)', fontSize: 14, marginBottom: 16 }}>
        This link is missing a token. Please request a new one.
      </p>
      <Link href="/forgot-password" className="btn-primary" style={{ display: 'inline-block' }}>
        Request new link
      </Link>
    </div>
  );

  if (done) return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 40, marginBottom: 12 }}>✓</div>
      <p style={{ color: 'var(--text-2)', fontSize: 14, lineHeight: 1.6 }}>
        Password updated. Redirecting you to sign in…
      </p>
    </div>
  );

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {error && (
        <div style={{ fontSize: 13, padding: '8px 12px', borderRadius: 8, background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }}>
          {error}
        </div>
      )}

      <div>
        <label style={{ fontSize: 12, color: 'var(--text-3)', display: 'block', marginBottom: 6 }}>New password</label>
        <input type="password" className="input" required minLength={8}
          autoComplete="new-password" value={password}
          onChange={(e) => setPassword(e.target.value)} />
        <p style={{ fontSize: 11, marginTop: 4, color: strongEnough || !password ? 'var(--text-3)' : '#ef4444' }}>
          Min 8 chars · uppercase · lowercase · number · special character
        </p>
      </div>

      <div>
        <label style={{ fontSize: 12, color: 'var(--text-3)', display: 'block', marginBottom: 6 }}>Confirm password</label>
        <input type="password" className="input" required autoComplete="new-password"
          value={confirm} onChange={(e) => setConfirm(e.target.value)}
          style={{ borderColor: confirm && !passwordsMatch ? 'rgba(239,68,68,0.5)' : undefined }} />
      </div>

      <button type="submit" className="btn-primary" style={{ padding: '10px 0' }}
        disabled={loading || !password || !confirm || !passwordsMatch || !strongEnough}>
        {loading ? 'Updating…' : 'Set new password'}
      </button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, background: 'var(--bg-base)' }}>
      <div style={{ width: '100%', maxWidth: 380 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <Link href="/" style={{ fontSize: 24, fontWeight: 700, color: 'var(--accent)', textDecoration: 'none' }}>AniRate</Link>
          <h1 style={{ fontSize: 20, fontWeight: 600, color: 'var(--text-1)', margin: '16px 0 4px' }}>New password</h1>
          <p style={{ fontSize: 14, color: 'var(--text-3)' }}>Choose a strong password</p>
        </div>
        <div className="card" style={{ padding: 24 }}>
          <Suspense fallback={<p style={{ color: 'var(--text-3)', fontSize: 13 }}>Loading…</p>}>
            <ResetForm />
          </Suspense>
        </div>
      </div>
    </main>
  );
}
