'use client';

// LoginPage is intentionally small: submit credentials, surface backend errors,
// then hand navigation back to the catalog after a successful sign-in.
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { AuthLayout, PasswordInput, errorMessage } from '@/components/AuthLayout';
import { useAuthStore } from '@/lib/auth.store';

export default function LoginPage() {
  const router = useRouter();
  const login = useAuthStore((state) => state.login);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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
    } catch (err) {
      setError(errorMessage(err, 'That email and password do not match an account.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout title="Sign in" subtitle="Welcome back. Your ratings and notes are where you left them.">
      <form onSubmit={handleSubmit} className="form">
        {error ? (
          <div role="alert" className="notice notice--error">
            {error}
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
            aria-invalid={error ? true : undefined}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>

        <div className="field">
          <div className="field__row">
            <label htmlFor="password" className="field__label signage">
              Password
            </label>
            <Link href="/forgot-password" className="link link--ruled muted" style={{ fontSize: '0.8125rem' }}>
              Forgot it?
            </Link>
          </div>
          <PasswordInput
            id="password"
            value={password}
            onChange={setPassword}
            autoComplete="current-password"
            visible={showPassword}
            onToggle={() => setShowPassword((current) => !current)}
          />
        </div>

        <button type="submit" className="btn btn--ink btn--block" disabled={loading}>
          {loading ? 'Signing in…' : 'Sign in'}
        </button>

        <p className="form__aside">
          New to AniRate?{' '}
          <Link href="/register" className="link link--ruled link--klein">
            Create an account
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
}
