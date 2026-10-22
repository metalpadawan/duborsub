'use client';

// ResetPasswordPage completes the reset the forgot-password page starts. The
// token arrives in the link; if someone opens the page without one, they can paste it.
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { AuthLayout, PASSWORD_RULES, PasswordInput, PasswordRules, errorMessage } from '@/components/AuthLayout';
import { authApi } from '@/lib/api';

export default function ResetPasswordPage() {
  return (
    <AuthLayout title="Choose a new password" subtitle="Signing in with it will end every other session on your account.">
      <Suspense fallback={null}>
        <ResetForm />
      </Suspense>
    </AuthLayout>
  );
}

function ResetForm() {
  const tokenFromLink = useSearchParams()?.get('token') ?? '';
  const [token, setToken] = useState(tokenFromLink);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);
  const meetsPolicy = PASSWORD_RULES.every((rule) => rule.test(password));

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');

    if (!meetsPolicy) {
      setError('The new password does not meet every requirement yet.');
      return;
    }

    setLoading(true);
    try {
      await authApi.resetPassword(token.trim(), password);
      setDone(true);
    } catch (err) {
      setError(errorMessage(err, 'That reset link is invalid or has expired. Request a new one.'));
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <div className="form">
        <div role="status" className="notice notice--ok">
          Your password has been changed and every other session has been signed out.
        </div>
        <Link href="/login" className="btn btn--ink btn--block">
          Sign in with your new password
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="form">
      {error ? (
        <div role="alert" className="notice notice--error">
          {error}{' '}
          <Link href="/forgot-password" className="link link--ruled">
            Request a new link
          </Link>
        </div>
      ) : null}

      {tokenFromLink ? null : (
        <div className="field">
          <label htmlFor="token" className="field__label signage">
            Reset code
          </label>
          <input
            id="token"
            type="text"
            className="input"
            required
            minLength={32}
            autoComplete="one-time-code"
            value={token}
            onChange={(event) => setToken(event.target.value)}
          />
        </div>
      )}

      <div className="field">
        <label htmlFor="password" className="field__label signage">
          New password
        </label>
        <PasswordInput
          id="password"
          value={password}
          onChange={setPassword}
          autoComplete="new-password"
          minLength={8}
          describedBy="password-rules"
          visible={showPassword}
          onToggle={() => setShowPassword((current) => !current)}
        />
        <PasswordRules id="password-rules" value={password} />
      </div>

      <button type="submit" className="btn btn--ink btn--block" disabled={loading}>
        {loading ? 'Saving…' : 'Save new password'}
      </button>
    </form>
  );
}
