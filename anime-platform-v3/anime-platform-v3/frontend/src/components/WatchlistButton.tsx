// src/components/WatchlistButton.tsx
// Drop-in component for anime detail page and catalog cards
'use client';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/auth.store';

const STATUSES = [
  { key: 'plan_to_watch', label: 'Plan to watch', color: '#a855f7' },
  { key: 'watching',      label: 'Watching',       color: '#3b82f6' },
  { key: 'completed',     label: 'Completed',      color: '#22c55e' },
  { key: 'on_hold',       label: 'On hold',        color: '#f59e0b' },
  { key: 'dropped',       label: 'Dropped',        color: '#ef4444' },
];

interface Props {
  animeId: string;
  compact?: boolean; // true = icon-only button for catalog cards
}

export default function WatchlistButton({ animeId, compact = false }: Props) {
  const { user } = useAuthStore();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: status } = useQuery({
    queryKey: ['watchlist-status', animeId],
    queryFn: () => api.get(`/watchlist/${animeId}/status`).then(r => r.data.data ?? r.data),
    enabled: !!user,
  });

  const upsertMutation = useMutation({
    mutationFn: (s: string) => api.post(`/watchlist/${animeId}`, { status: s }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['watchlist-status', animeId] });
      qc.invalidateQueries({ queryKey: ['watchlist'] });
      setOpen(false);
    },
  });

  const removeMutation = useMutation({
    mutationFn: () => api.delete(`/watchlist/${animeId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['watchlist-status', animeId] });
      qc.invalidateQueries({ queryKey: ['watchlist'] });
      setOpen(false);
    },
  });

  if (!user) return null;

  const current = STATUSES.find(s => s.key === status?.status);
  const isAdded = !!current;

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          padding: compact ? '6px 8px' : '8px 16px',
          borderRadius: 8, fontSize: compact ? 14 : 13, cursor: 'pointer',
          border: `1px solid ${isAdded ? (current?.color ?? 'var(--accent)') : 'var(--border)'}`,
          background: isAdded ? `${current?.color ?? 'var(--accent)'}15` : 'var(--bg-card)',
          color: isAdded ? (current?.color ?? 'var(--accent)') : 'var(--text-3)',
          transition: 'all 0.15s', display: 'flex', alignItems: 'center', gap: 6,
        }}
      >
        {isAdded ? '✓' : '+'}{!compact && (isAdded ? current!.label : 'Add to list')}
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div style={{ position: 'fixed', inset: 0, zIndex: 10 }} onClick={() => setOpen(false)} />
          <div style={{
            position: 'absolute', top: '100%', left: 0, zIndex: 20, marginTop: 6,
            background: 'var(--bg-card)', border: '1px solid var(--border)',
            borderRadius: 10, overflow: 'hidden', minWidth: 180,
            boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
          }}>
            {STATUSES.map(({ key, label, color }) => (
              <button
                key={key}
                onClick={() => upsertMutation.mutate(key)}
                disabled={upsertMutation.isPending}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                  padding: '9px 14px', fontSize: 13, textAlign: 'left', cursor: 'pointer',
                  color: key === status?.status ? color : 'var(--text-2)',
                  background: key === status?.status ? `${color}10` : 'transparent',
                  border: 'none',
                }}
              >
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
                {label}
                {key === status?.status && <span style={{ marginLeft: 'auto', fontSize: 11 }}>✓</span>}
              </button>
            ))}
            {isAdded && (
              <>
                <div style={{ height: 1, background: 'var(--border)' }} />
                <button
                  onClick={() => removeMutation.mutate()}
                  style={{ display: 'block', width: '100%', padding: '9px 14px', fontSize: 13, textAlign: 'left', color: '#ef4444', background: 'transparent', border: 'none', cursor: 'pointer' }}
                >
                  Remove from list
                </button>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
