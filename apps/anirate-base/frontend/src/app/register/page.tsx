'use client';

// RegisterPage creates an account and then signs the new user in so the flow
// feels like a single action instead of two disconnected steps.
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { AuthLayout, PasswordInput, PasswordRules, errorMessage } from '@/components/AuthLayout';
import { useAuthStore } from '@/lib/auth.store';

export default function RegisterPage() {
  const router = useRouter();
  const register = useAuthStore((state) => state.register);
  const login = useAuthStore((state) => state.login);
  const [form, setForm] = useState({ username: '', email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // A small field updater keeps the JSX inputs readable without repeating state merge logic.
  const updateField = (field: 'username' | 'email' | 'password') => (value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setLoading(true);

    try {
      await register(form.username, form.email, form.password);
      // The backend returns registration success but not an access token, so we
      // immediately log the user in with the same credentials.
      await login(form.email, form.password);
      router.push('/');
    } catch (err) {
      setError(errorMessage(err, 'We could not create that account. Check the details and try again.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout title="Create an account" subtitle="Rate the sub and the dub of anything you have watched.">
      <form onSubmit={handleSubmit} className="form">
        {error ? (
          <div role="alert" className="notice notice--error">
            {error}
          </div>
        ) : null}

        <div className="field">
          <label htmlFor="username" className="field__label signage">
            Username
          </label>
          <input
            id="username"
            type="text"
            className="input"
            required
            minLength={3}
            maxLength={30}
            pattern="[a-zA-Z0-9_\-]+"
            autoComplete="username"
            aria-describedby="username-help"
            value={form.username}
            onChange={(event) => updateField('username')(event.target.value)}
          />
          <p id="username-help" className="muted" style={{ fontSize: '0.8125rem' }}>
            3–30 characters: letters, numbers, underscores, or hyphens. Shown on your notes.
          </p>
        </div>

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
            value={form.email}
            onChange={(event) => updateField('email')(event.target.value)}
          />
        </div>

        <div className="field">
          <label htmlFor="password" className="field__label signage">
            Password
          </label>
          <PasswordInput
            id="password"
            value={form.password}
            onChange={updateField('password')}
            autoComplete="new-password"
            minLength={8}
            describedBy="password-rules"
            visible={showPassword}
            onToggle={() => setShowPassword((current) => !current)}
          />
          <PasswordRules id="password-rules" value={form.password} />
        </div>

        <button type="submit" className="btn btn--ink btn--block" disabled={loading}>
          {loading ? 'Creating your account…' : 'Create account'}
        </button>

        <p className="form__aside">
          Already have an account?{' '}
          <Link href="/login" className="link link--ruled link--klein">
            Sign in
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
}
