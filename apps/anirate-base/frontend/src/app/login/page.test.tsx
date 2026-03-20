import { createElement, type ReactNode } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import LoginPage from './page';

const mockPush = vi.fn();
const mockLogin = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: { children: ReactNode; href: string }) =>
    createElement('a', { href, ...props }, children),
}));

vi.mock('@/lib/auth.store', () => ({
  useAuthStore: (
    selector: (state: { login: typeof mockLogin }) => unknown,
  ) => selector({ login: mockLogin }),
}));

describe('LoginPage', () => {
  beforeEach(() => {
    mockLogin.mockReset();
    mockPush.mockReset();
  });

  it('shows an error and resets loading when credentials are invalid', async () => {
    mockLogin.mockRejectedValueOnce({
      response: {
        data: {
          message: 'Invalid credentials',
        },
      },
    });

    const user = userEvent.setup();

    render(createElement(LoginPage));

    await user.type(screen.getByLabelText(/email/i), 'nobody@example.com');
    await user.type(screen.getByLabelText(/password/i), 'WrongPassword123!');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('nobody@example.com', 'WrongPassword123!');
    });

    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid credentials');

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /sign in/i })).toBeEnabled();
    });

    expect(mockPush).not.toHaveBeenCalled();
  });

  it('redirects to the catalog when login succeeds', async () => {
    mockLogin.mockResolvedValueOnce(undefined);

    const user = userEvent.setup();

    render(createElement(LoginPage));

    await user.type(screen.getByLabelText(/email/i), 'demo@example.com');
    await user.type(screen.getByLabelText(/password/i), 'Password123!');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('demo@example.com', 'Password123!');
    });

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/');
    });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /sign in/i })).toBeEnabled();
    });
  });
});
