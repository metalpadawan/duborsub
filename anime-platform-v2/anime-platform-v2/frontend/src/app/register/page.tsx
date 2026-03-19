'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/auth.store';

export default function RegisterPage() {
  const router = useRouter();
  const { register, login } = useAuthStore();
  const [form, setForm] = useState({ username: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const set = (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await register(form.username, form.email, form.password);
      await login(form.email, form.password);
      router.push('/');
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      setError(Array.isArray(msg) ? msg.join(', ') : (msg ?? 'Registration failed'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, background: 'var(--bg-base)' }}>
      <div style={{ width: '100%', maxWidth: 380 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <Link href="/" style={{ fontSize: 24, fontWeight: 700, color: 'var(--accent)', textDecoration: 'none' }}>AniRate</Link>
          <h1 style={{ fontSize: 20, fontWeight: 600, color: 'var(--text-1)', margin: '16px 0 4px' }}>Create account</h1>
          <p style={{ fontSize: 14, color: 'var(--text-3)' }}>Join the sub vs dub debate</p>
        </div>

        <div className="card" style={{ padding: 24 }}>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {error && (
              <div style={{ fontSize: 13, padding: '8px 12px', borderRadius: 8, background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }}>
                {error}
              </div>
            )}

            <div>
              <label style={{ fontSize: 12, color: 'var(--text-3)', display: 'block', marginBottom: 6 }}>Username</label>
              <input type="text" className="input" required minLength={3} maxLength={30}
                placeholder="e.g. otaku_phoenix"
                value={form.username} onChange={set('username')} />
            </div>

            <div>
              <label style={{ fontSize: 12, color: 'var(--text-3)', display: 'block', marginBottom: 6 }}>Email</label>
              <input type="email" className="input" required autoComplete="email"
                value={form.email} onChange={set('email')} />
            </div>

            <div>
              <label style={{ fontSize: 12, color: 'var(--text-3)', display: 'block', marginBottom: 6 }}>Password</label>
              <input type="password" className="input" required minLength={8}
                autoComplete="new-password"
                value={form.password} onChange={set('password')} />
              <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>
                Min 8 chars · uppercase · number · special character
              </p>
            </div>

            <button type="submit" className="btn-primary" style={{ padding: '10px 0' }} disabled={loading}>
              {loading ? 'Creating account…' : 'Create account'}
            </button>

            <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--text-3)' }}>
              Already have an account?{' '}
              <Link href="/login" style={{ color: 'var(--accent)' }}>Sign in</Link>
            </p>
          </form>
        </div>
      </div>
    </main>
  );
}
