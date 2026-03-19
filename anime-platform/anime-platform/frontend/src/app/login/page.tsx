// src/app/login/page.tsx
'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/auth.store';

export default function LoginPage() {
  const router = useRouter();
  const login = useAuthStore((s) => s.login);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      router.push('/');
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout title="Welcome back" subtitle="Sign in to rate and review anime">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {error && (
          <div className="text-sm px-3 py-2 rounded-lg"
               style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }}>
            {error}
          </div>
        )}
        <div>
          <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-3)' }}>Email</label>
          <input
            type="email" className="input" required autoComplete="email"
            value={email} onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div>
          <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-3)' }}>Password</label>
          <input
            type="password" className="input" required autoComplete="current-password"
            value={password} onChange={(e) => setPassword(e.target.value)}
          />
          <div className="text-right mt-1">
            <Link href="/forgot-password" className="text-xs" style={{ color: 'var(--text-3)' }}>
              Forgot password?
            </Link>
          </div>
        </div>
        <button type="submit" className="btn-primary w-full py-2.5" disabled={loading}>
          {loading ? 'Signing in...' : 'Sign in'}
        </button>
        <p className="text-center text-sm" style={{ color: 'var(--text-3)' }}>
          No account?{' '}
          <Link href="/register" style={{ color: 'var(--accent)' }}>Create one</Link>
        </p>
      </form>
    </AuthLayout>
  );
}

// ────────────────────────────────────────────────────────────
// src/app/register/page.tsx
'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/auth.store';

export function RegisterPage() {
  const router = useRouter();
  const { register, login } = useAuthStore();
  const [form, setForm] = useState({ username: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
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
  };

  return (
    <AuthLayout title="Join AniRate" subtitle="Rate anime sub and dub versions">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {error && (
          <div className="text-sm px-3 py-2 rounded-lg"
               style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }}>
            {error}
          </div>
        )}
        <div>
          <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-3)' }}>Username</label>
          <input type="text" className="input" required minLength={3} maxLength={30}
            placeholder="e.g. otaku_phoenix" value={form.username} onChange={set('username')} />
        </div>
        <div>
          <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-3)' }}>Email</label>
          <input type="email" className="input" required autoComplete="email"
            value={form.email} onChange={set('email')} />
        </div>
        <div>
          <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-3)' }}>Password</label>
          <input type="password" className="input" required minLength={8}
            autoComplete="new-password" value={form.password} onChange={set('password')} />
          <p className="text-xs mt-1" style={{ color: 'var(--text-3)' }}>
            Min 8 chars · uppercase · number · special character
          </p>
        </div>
        <button type="submit" className="btn-primary w-full py-2.5" disabled={loading}>
          {loading ? 'Creating account...' : 'Create account'}
        </button>
        <p className="text-center text-sm" style={{ color: 'var(--text-3)' }}>
          Already have an account?{' '}
          <Link href="/login" style={{ color: 'var(--accent)' }}>Sign in</Link>
        </p>
      </form>
    </AuthLayout>
  );
}

export default RegisterPage;

// ────────────────────────────────────────────────────────────
// Shared auth layout wrapper
function AuthLayout({ title, subtitle, children }: {
  title: string; subtitle: string; children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen flex items-center justify-center px-4"
          style={{ background: 'var(--bg-base)' }}>
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Link href="/" className="text-2xl font-bold" style={{ color: 'var(--accent)' }}>
            AniRate
          </Link>
          <h1 className="text-xl font-semibold mt-4 mb-1" style={{ color: 'var(--text-1)' }}>
            {title}
          </h1>
          <p className="text-sm" style={{ color: 'var(--text-3)' }}>{subtitle}</p>
        </div>
        <div className="card p-6">{children}</div>
      </div>
    </main>
  );
}
