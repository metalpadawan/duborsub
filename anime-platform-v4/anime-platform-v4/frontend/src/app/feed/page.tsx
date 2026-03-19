// src/app/feed/page.tsx — Social activity feed
'use client';
import { useState } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import Link from 'next/link';
import Image from 'next/image';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/auth.store';
import { useRouter } from 'next/navigation';

const fetchFeed = ({ pageParam }: { pageParam?: string }) =>
  api.get('/social/feed', { params: pageParam ? { cursor: pageParam } : {} })
    .then(r => r.data.data ?? r.data);

export default function FeedPage() {
  const { user, isLoading: authLoading } = useAuthStore();
  const router = useRouter();

  if (!authLoading && !user) { router.replace('/login'); return null; }

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } =
    useInfiniteQuery({
      queryKey: ['feed'],
      queryFn: fetchFeed,
      initialPageParam: undefined as string | undefined,
      getNextPageParam: (last: any) => last.hasMore ? last.nextCursor : undefined,
      enabled: !!user,
    });

  const items = data?.pages.flatMap((p: any) => p.items) ?? [];

  return (
    <main style={{ minHeight: '100vh', background: 'var(--bg-base)' }}>
      <div style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-surface)' }}>
        <div style={{ maxWidth: 680, margin: '0 auto', padding: '20px' }}>
          <Link href="/" style={{ fontSize: 13, color: 'var(--text-3)', textDecoration: 'none' }}>← Home</Link>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-1)', margin: '8px 0 0' }}>Following feed</h1>
        </div>
      </div>

      <div style={{ maxWidth: 680, margin: '0 auto', padding: '24px 20px' }}>
        {isLoading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="card animate-pulse" style={{ height: 80 }} />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <p style={{ fontSize: 16, color: 'var(--text-2)', marginBottom: 8 }}>Your feed is empty</p>
            <p style={{ fontSize: 14, color: 'var(--text-3)', marginBottom: 20 }}>
              Follow other users to see their ratings and comments here
            </p>
            <Link href="/" className="btn-primary" style={{ display: 'inline-block' }}>Browse catalog</Link>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {items.map((item: any) => (
                <FeedItem key={`${item.type}-${item.id}`} item={item} />
              ))}
            </div>
            {hasNextPage && (
              <div style={{ textAlign: 'center', marginTop: 24 }}>
                <button onClick={() => fetchNextPage()} disabled={isFetchingNextPage}
                  className="btn-ghost" style={{ padding: '10px 24px' }}>
                  {isFetchingNextPage ? 'Loading…' : 'Load more'}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}

function FeedItem({ item }: { item: any }) {
  const isRating = item.type === 'rating';
  return (
    <div className="card" style={{ padding: '14px 16px', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
      {/* Cover thumb */}
      <Link href={`/anime/${item.anime.id}`} style={{ flexShrink: 0 }}>
        <div style={{ width: 36, height: 52, borderRadius: 4, overflow: 'hidden', background: 'var(--bg-hover)' }}>
          {item.anime.coverImageUrl
            ? <Image src={item.anime.coverImageUrl} alt={item.anime.title} width={36} height={52} style={{ objectFit: 'cover' }} />
            : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>⛩</div>}
        </div>
      </Link>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
          <div>
            <Link href={`/profile/${item.user.username}`} style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent)', textDecoration: 'none' }}>
              {item.user.username}
            </Link>
            <span style={{ fontSize: 13, color: 'var(--text-3)' }}>
              {isRating ? ' rated ' : ' commented on '}
            </span>
            <Link href={`/anime/${item.anime.id}`} style={{ fontSize: 13, color: 'var(--text-2)', textDecoration: 'none' }}>
              {item.anime.title}
            </Link>
          </div>
          <span style={{ fontSize: 11, color: 'var(--text-3)', flexShrink: 0 }}>
            {timeAgo(item.timestamp)}
          </span>
        </div>

        {isRating ? (
          <div style={{ display: 'flex', gap: 12, marginTop: 6 }}>
            {item.subRating && <span style={{ fontSize: 12, color: '#3b82f6' }}>Sub ★{item.subRating}</span>}
            {item.dubRating && <span style={{ fontSize: 12, color: 'var(--accent)' }}>Dub ★{item.dubRating}</span>}
          </div>
        ) : (
          <p style={{ fontSize: 13, color: 'var(--text-2)', marginTop: 6, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            {item.content}
          </p>
        )}
      </div>
    </div>
  );
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}
