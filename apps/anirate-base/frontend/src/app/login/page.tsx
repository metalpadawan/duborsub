'use client';

// LoginPage is intentionally small: submit credentials, surface backend errors,
// then hand navigation back to the catalog after a successful sign-in.
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { AuthLayout } from '@/components/AuthLayout';
import { useAuthStore } from '@/lib/auth.store';

export default function LoginPage() {
  const router = useRouter();
  const login = useAuthStore((state) => state.login);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(email, password);
      // We redirect after the store is populated so the header renders the signed-in state immediately.
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
        {error ? (
          <div
            role="alert"
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
          <label htmlFor="email" className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-3)' }}>
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

        <div>
          <label htmlFor="password" className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-3)' }}>
            Password
          </label>
          <input
            id="password"
            type="password"
            className="input"
            required
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
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
          <Link href="/register" style={{ color: 'var(--accent)' }}>
            Create one
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
}
