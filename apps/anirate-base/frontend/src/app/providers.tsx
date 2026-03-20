'use client';

// Providers wraps global client-side state providers used by the App Router tree.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { useAuthStore } from '@/lib/auth.store';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
});

export function Providers({ children }: { children: React.ReactNode }) {
  const loadUser = useAuthStore((state) => state.loadUser);
  const loaded = useRef(false);

  useEffect(() => {
    // Hydrate auth state once on boot so the header and guarded actions know who is signed in.
    if (!loaded.current) {
      loaded.current = true;
      loadUser();
    }
  }, [loadUser]);

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
