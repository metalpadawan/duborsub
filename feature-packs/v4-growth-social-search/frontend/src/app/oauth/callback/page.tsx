// src/app/oauth/callback/page.tsx
// Receives the access token from the OAuth redirect, stores it, redirects home
'use client';
import { useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { tokenStore } from '@/lib/api';
import { useAuthStore } from '@/lib/auth.store';

function OAuthCallbackInner() {
  const params = useSearchParams();
  const router = useRouter();
  const loadUser = useAuthStore(s => s.loadUser);

  useEffect(() => {
    const token = params.get('token');
    if (token) {
      tokenStore.set(token);
      loadUser().then(() => router.replace('/'));
    } else {
      router.replace('/login?error=oauth_failed');
    }
  }, [params, router, loadUser]);

  return (
    <main style={{ minHeight: '100vh', background: 'var(--bg-base)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 40, height: 40, borderRadius: '50%', border: '3px solid rgba(224,64,176,0.3)', borderTopColor: 'var(--accent)', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }} />
        <p style={{ color: 'var(--text-3)', fontSize: 14 }}>Signing you in…</p>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </main>
  );
}

export default function OAuthCallbackPage() {
  return (
    <Suspense fallback={null}>
      <OAuthCallbackInner />
    </Suspense>
  );
}

// ─────────────────────────────────────────────────────────────
// src/components/FollowButton.tsx
// ─────────────────────────────────────────────────────────────
'use client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/auth.store';

export function FollowButton({ username }: { username: string }) {
  const { user } = useAuthStore();
  const qc = useQueryClient();

  const { data } = useQuery({
    queryKey: ['follow-status', username],
    queryFn: () => api.get(`/social/follow/${username}/status`).then(r => r.data.data ?? r.data),
    enabled: !!user && user.username !== username,
  });

  const mutation = useMutation({
    mutationFn: (following: boolean) =>
      following
        ? api.delete(`/social/follow/${username}`)
        : api.post(`/social/follow/${username}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['follow-status', username] });
      qc.invalidateQueries({ queryKey: ['feed'] });
    },
  });

  if (!user || user.username === username) return null;

  const isFollowing = data?.following ?? false;

  return (
    <button
      onClick={() => mutation.mutate(isFollowing)}
      disabled={mutation.isPending}
      style={{
        padding: '7px 18px', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer',
        border: `1px solid ${isFollowing ? 'var(--border)' : 'var(--accent)'}`,
        background: isFollowing ? 'var(--bg-card)' : 'rgba(224,64,176,0.12)',
        color: isFollowing ? 'var(--text-3)' : 'var(--accent)',
        transition: 'all 0.15s',
      }}
    >
      {mutation.isPending ? '…' : isFollowing ? 'Following' : 'Follow'}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────
// src/components/RecommendationRow.tsx
// Shows personalised recommendations or popular fallback
// Drop into the homepage below the catalog grid
// ─────────────────────────────────────────────────────────────
'use client';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import Image from 'next/image';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/auth.store';

export function RecommendationRow() {
  const { user } = useAuthStore();

  const { data, isLoading } = useQuery({
    queryKey: ['recs', user?.id],
    queryFn: () => user
      ? api.get('/recommendations/me').then(r => r.data.data ?? r.data)
      : api.get('/recommendations/popular').then(r => ({ type: 'popular', items: r.data.data ?? r.data })),
    staleTime: 300_000,
  });

  if (isLoading) return (
    <div style={{ marginTop: 40 }}>
      <div style={{ height: 20, width: 200, borderRadius: 4, background: 'var(--bg-card)', marginBottom: 16 }} className="animate-pulse" />
      <div style={{ display: 'flex', gap: 12, overflowX: 'hidden' }}>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} style={{ flexShrink: 0, width: 130 }}>
            <div style={{ aspectRatio: '2/3', borderRadius: 8, background: 'var(--bg-card)' }} className="animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  );

  if (!data?.items?.length) return null;

  const isPersonalised = data.type === 'collaborative';

  return (
    <div style={{ marginTop: 40 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 16 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-1)' }}>
          {isPersonalised ? 'Recommended for you' : 'Popular right now'}
        </h2>
        {isPersonalised && data.neighborCount && (
          <span style={{ fontSize: 12, color: 'var(--text-3)' }}>
            Based on {data.neighborCount} similar users
          </span>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 12 }}>
        {data.items.map((anime: any) => (
          <Link key={anime.id} href={`/anime/${anime.id}`} style={{ textDecoration: 'none' }}>
            <div style={{ aspectRatio: '2/3', borderRadius: 8, overflow: 'hidden', background: 'var(--bg-card)', position: 'relative', marginBottom: 6 }}>
              {anime.coverImageUrl
                ? <Image src={anime.coverImageUrl} alt={anime.title} fill style={{ objectFit: 'cover' }} sizes="150px" />
                : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, color: 'var(--text-3)' }}>⛩</div>}
            </div>
            <p style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 2 }}>
              {anime.title}
            </p>
            {anime.reason && (
              <p style={{ fontSize: 10, color: 'var(--text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {anime.reason}
              </p>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// src/components/SimilarAnime.tsx
// Shows similar anime on the detail page
// Usage: <SimilarAnime animeId={id} />
// ─────────────────────────────────────────────────────────────
'use client';
export function SimilarAnime({ animeId }: { animeId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['similar', animeId],
    queryFn: () => api.get(`/recommendations/similar/${animeId}`).then(r => r.data.data ?? r.data),
    staleTime: 300_000,
  });

  if (isLoading || !data?.length) return null;

  return (
    <div style={{ marginTop: 40 }}>
      <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-1)', marginBottom: 16 }}>Similar anime</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 12 }}>
        {data.map((anime: any) => (
          <Link key={anime.id} href={`/anime/${anime.id}`} style={{ textDecoration: 'none' }}>
            <div style={{ aspectRatio: '2/3', borderRadius: 8, overflow: 'hidden', background: 'var(--bg-card)', position: 'relative', marginBottom: 6 }}>
              {anime.coverImageUrl
                ? <Image src={anime.coverImageUrl} alt={anime.title} fill style={{ objectFit: 'cover' }} sizes="130px" />
                : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, color: 'var(--text-3)' }}>⛩</div>}
            </div>
            <p style={{ fontSize: 11, color: 'var(--text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{anime.title}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
