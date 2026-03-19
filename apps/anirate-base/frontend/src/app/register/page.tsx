'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { AuthLayout } from '@/components/AuthLayout';
import { useAuthStore } from '@/lib/auth.store';

export default function RegisterPage() {
  const router = useRouter();
  const register = useAuthStore((state) => state.register);
  const login = useAuthStore((state) => state.login);
  const [form, setForm] = useState({ username: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const updateField =
    (field: 'username' | 'email' | 'password') =>
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setForm((current) => ({ ...current, [field]: event.target.value }));
    };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setLoading(true);

    try {
      await register(form.username, form.email, form.password);
      await login(form.email, form.password);
      router.push('/');
    } catch (err: any) {
      const message = err?.response?.data?.message;
      setError(Array.isArray(message) ? message.join(', ') : message ?? 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout title="Join AniRate" subtitle="Rate anime sub and dub versions">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
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
            Username
          </label>
          <input
            type="text"
            className="input"
            required
            minLength={3}
            maxLength={30}
            value={form.username}
            onChange={updateField('username')}
          />
        </div>

        <div>
          <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-3)' }}>
            Email
          </label>
          <input
            type="email"
            className="input"
            required
            autoComplete="email"
            value={form.email}
            onChange={updateField('email')}
          />
        </div>

        <div>
          <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-3)' }}>
            Password
          </label>
          <input
            type="password"
            className="input"
            required
            minLength={8}
            autoComplete="new-password"
            value={form.password}
            onChange={updateField('password')}
          />
          <p className="text-xs mt-1" style={{ color: 'var(--text-3)' }}>
            Min 8 chars, uppercase, number, and special character.
          </p>
        </div>

        <button type="submit" className="btn-primary w-full py-2.5" disabled={loading}>
          {loading ? 'Creating account...' : 'Create account'}
        </button>

        <p className="text-center text-sm" style={{ color: 'var(--text-3)' }}>
          Already have an account?{' '}
          <Link href="/login" style={{ color: 'var(--accent)' }}>
            Sign in
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
}
