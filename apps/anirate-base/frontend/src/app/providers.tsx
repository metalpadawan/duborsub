'use client';

// Providers wraps global client-side state providers used by the App Router tree.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { useAuthStore } from '@/lib/auth.store';

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: 1,
        staleTime: 30_000,
      },
    },
  });
}

let browserQueryClient: QueryClient | undefined;

// On the server every render gets its own cache: a shared one would serve one
// request's data (stale counts, or another viewer's) into the next request's HTML.
// In the browser one cache is kept across pages.
function getQueryClient() {
  if (typeof window === 'undefined') {
    return makeQueryClient();
  }

  browserQueryClient ??= makeQueryClient();
  return browserQueryClient;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(getQueryClient);
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
