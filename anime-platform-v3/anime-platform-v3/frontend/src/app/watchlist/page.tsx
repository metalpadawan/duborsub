// src/app/watchlist/page.tsx
'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import Image from 'next/image';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/auth.store';
import { useRouter } from 'next/navigation';

const STATUSES = [
  { key: 'all',           label: 'All',            color: 'var(--text-2)' },
  { key: 'watching',      label: 'Watching',        color: '#3b82f6' },
  { key: 'plan_to_watch', label: 'Plan to watch',   color: '#a855f7' },
  { key: 'completed',     label: 'Completed',       color: '#22c55e' },
  { key: 'on_hold',       label: 'On hold',         color: '#f59e0b' },
  { key: 'dropped',       label: 'Dropped',         color: '#ef4444' },
];

const STATUS_COLOR: Record<string, string> = {
  watching: '#3b82f6', plan_to_watch: '#a855f7',
  completed: '#22c55e', on_hold: '#f59e0b', dropped: '#ef4444',
};

export default function WatchlistPage() {
  const { user, isLoading: authLoading } = useAuthStore();
  const router = useRouter();
  const qc = useQueryClient();
  const [activeStatus, setActiveStatus] = useState('all');

  if (!authLoading && !user) {
    router.replace('/login');
    return null;
  }

  const { data, isLoading } = useQuery({
    queryKey: ['watchlist'],
    queryFn: () => api.get('/watchlist').then(r => r.data.data ?? r.data),
    enabled: !!user,
  });

  const removeMutation = useMutation({
    mutationFn: (animeId: string) => api.delete(`/watchlist/${animeId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['watchlist'] }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ animeId, status }: { animeId: string; status: string }) =>
      api.post(`/watchlist/${animeId}`, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['watchlist'] }),
  });

  const entries: any[] = data?.entries ?? [];
  const filtered = activeStatus === 'all'
    ? entries
    : entries.filter((e: any) => e.status === activeStatus);

  const stats = data?.grouped
    ? Object.entries(data.grouped as Record<string, any[]>).reduce(
        (acc, [k, v]) => ({ ...acc, [k]: v.length }),
        {} as Record<string, number>,
      )
    : {};

  return (
    <main style={{ minHeight: '100vh', background: 'var(--bg-base)' }}>
      {/* Header */}
      <div style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-surface)' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <Link href="/" style={{ fontSize: 13, color: 'var(--text-3)', textDecoration: 'none' }}>← Catalog</Link>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-1)', margin: '8px 0 0' }}>My Watchlist</h1>
          </div>
          <span style={{ fontSize: 13, color: 'var(--text-3)' }}>{entries.length} titles</span>
        </div>
      </div>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 20px' }}>
        {/* Status tabs */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 24 }}>
          {STATUSES.map(({ key, label, color }) => (
            <button
              key={key}
              onClick={() => setActiveStatus(key)}
              style={{
                padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 500, cursor: 'pointer',
                border: `1px solid ${activeStatus === key ? color : 'var(--border)'}`,
                background: activeStatus === key ? `${color}18` : 'var(--bg-card)',
                color: activeStatus === key ? color : 'var(--text-3)',
                transition: 'all 0.15s',
              }}
            >
              {label}
              {key !== 'all' && stats[key] > 0 && (
                <span style={{ marginLeft: 6, fontSize: 10, opacity: 0.7 }}>{stats[key]}</span>
              )}
            </button>
          ))}
        </div>

        {/* Grid */}
        {isLoading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 16 }}>
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="animate-pulse">
                <div style={{ aspectRatio: '2/3', borderRadius: 8, background: 'var(--bg-card)', marginBottom: 8 }} />
                <div style={{ height: 12, borderRadius: 4, background: 'var(--bg-card)', width: '80%' }} />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-3)' }}>
            <p style={{ fontSize: 16, marginBottom: 8 }}>Nothing here yet</p>
            <Link href="/" style={{ color: 'var(--accent)', fontSize: 14 }}>Browse the catalog →</Link>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 16 }}>
            {filtered.map((entry: any) => (
              <WatchlistCard
                key={entry.id}
                entry={entry}
                onStatusChange={(status) => updateMutation.mutate({ animeId: entry.animeId, status })}
                onRemove={() => removeMutation.mutate(entry.animeId)}
              />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

function WatchlistCard({ entry, onStatusChange, onRemove }: {
  entry: any;
  onStatusChange: (s: string) => void;
  onRemove: () => void;
}) {
  const [open, setOpen] = useState(false);
  const color = STATUS_COLOR[entry.status] ?? 'var(--text-3)';

  return (
    <div style={{ position: 'relative' }}>
      <Link href={`/anime/${entry.anime.id}`} style={{ textDecoration: 'none', display: 'block' }}>
        <div style={{ aspectRatio: '2/3', borderRadius: 8, overflow: 'hidden', background: 'var(--bg-card)', marginBottom: 8, position: 'relative' }}>
          {entry.anime.coverImageUrl ? (
            <Image src={entry.anime.coverImageUrl} alt={entry.anime.title} fill style={{ objectFit: 'cover' }} sizes="200px" />
          ) : (
            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-3)', fontSize: 28 }}>⛩</div>
          )}
          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0, padding: '4px 8px',
            background: 'rgba(0,0,0,0.7)', fontSize: 10, fontWeight: 600,
            color: color, textTransform: 'uppercase', letterSpacing: '0.05em',
          }}>
            {entry.status.replace(/_/g, ' ')}
          </div>
        </div>
        <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {entry.anime.title}
        </p>
      </Link>

      {/* Quick-change status menu */}
      <div style={{ position: 'relative', marginTop: 4 }}>
        <button
          onClick={() => setOpen(!open)}
          style={{ width: '100%', padding: '5px 8px', borderRadius: 6, fontSize: 11, background: 'var(--bg-hover)', border: '1px solid var(--border)', color: 'var(--text-3)', cursor: 'pointer', textAlign: 'left' }}
        >
          Change status ▾
        </button>
        {open && (
          <div style={{
            position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 20,
            background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8,
            marginTop: 4, overflow: 'hidden', boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
          }}>
            {STATUSES.filter(s => s.key !== 'all').map(({ key, label, color }) => (
              <button
                key={key}
                onClick={() => { onStatusChange(key); setOpen(false); }}
                style={{
                  display: 'block', width: '100%', padding: '8px 12px', textAlign: 'left',
                  fontSize: 12, color: key === entry.status ? color : 'var(--text-2)',
                  background: key === entry.status ? `${color}10` : 'transparent',
                  border: 'none', cursor: 'pointer',
                }}
              >
                {label}
              </button>
            ))}
            <div style={{ borderTop: '1px solid var(--border)' }}>
              <button
                onClick={() => { onRemove(); setOpen(false); }}
                style={{ display: 'block', width: '100%', padding: '8px 12px', textAlign: 'left', fontSize: 12, color: '#ef4444', background: 'transparent', border: 'none', cursor: 'pointer' }}
              >
                Remove from list
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
