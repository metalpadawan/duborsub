// src/app/admin/users/page.tsx
'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

async function fetchUsers(search: string, page: number) {
  const { data } = await api.get('/admin/users', { params: { search, page, limit: 25 } });
  return data;
}

export default function AdminUsersPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [banTarget, setBanTarget] = useState<{ id: string; username: string } | null>(null);
  const [banReason, setBanReason] = useState('');
  const [banUntil, setBanUntil] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['admin-users', search, page],
    queryFn: () => fetchUsers(search, page),
    placeholderData: (p) => p,
  });

  const banMutation = useMutation({
    mutationFn: ({ id, reason, bannedUntil }: any) =>
      api.post(`/admin/users/${id}/ban`, { reason, bannedUntil: bannedUntil || undefined }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-users'] });
      setBanTarget(null);
      setBanReason('');
      setBanUntil('');
    },
  });

  const unbanMutation = useMutation({
    mutationFn: (id: string) => api.post(`/admin/users/${id}/unban`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-users'] }),
  });

  return (
    <div>
      {/* Search bar */}
      <div style={{ marginBottom: 20, display: 'flex', gap: 12, alignItems: 'center' }}>
        <input
          className="admin-input"
          placeholder="Search username or email..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          style={{ width: 280 }}
        />
        <span style={{ fontSize: 11, color: '#3d3a4e' }}>
          {data?.pagination?.total ?? 0} users
        </span>
      </div>

      <div className="admin-table-wrap">
        <table>
          <thead>
            <tr>
              <th>Username</th>
              <th>Email</th>
              <th>Role</th>
              <th>Status</th>
              <th>Ratings</th>
              <th>Comments</th>
              <th>Joined</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={8} style={{ textAlign: 'center', color: '#3d3a4e', padding: 32 }}>Loading...</td></tr>
            )}
            {data?.users?.map((user: any) => (
              <tr key={user.id}>
                <td style={{ color: '#c0b8d8', fontWeight: 500 }}>{user.username}</td>
                <td style={{ color: '#5a5570' }}>{user.email}</td>
                <td>
                  <span className={`badge badge-${user.role}`}>{user.role}</span>
                </td>
                <td>
                  {user.isBanned
                    ? <span className="badge badge-banned">banned</span>
                    : <span className="badge badge-ok">active</span>}
                </td>
                <td>{user._count?.ratings ?? 0}</td>
                <td>{user._count?.comments ?? 0}</td>
                <td style={{ color: '#3d3a4e' }}>
                  {new Date(user.createdAt).toLocaleDateString()}
                </td>
                <td>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {user.isBanned ? (
                      <button
                        className="action-btn success"
                        onClick={() => unbanMutation.mutate(user.id)}
                        disabled={unbanMutation.isPending}
                      >
                        Unban
                      </button>
                    ) : user.role !== 'admin' ? (
                      <button
                        className="action-btn danger"
                        onClick={() => setBanTarget({ id: user.id, username: user.username })}
                      >
                        Ban
                      </button>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {data?.pagination && data.pagination.pages > 1 && (
        <div style={{ display: 'flex', gap: 6, marginTop: 16, justifyContent: 'flex-end' }}>
          {Array.from({ length: data.pagination.pages }, (_, i) => i + 1).map((p) => (
            <button
              key={p}
              className="action-btn"
              onClick={() => setPage(p)}
              style={{ color: p === page ? '#e040b0' : undefined, borderColor: p === page ? 'rgba(224,64,176,0.3)' : undefined }}
            >
              {p}
            </button>
          ))}
        </div>
      )}

      {/* Ban modal */}
      {banTarget && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50,
        }}>
          <div style={{
            background: '#0f0f1a', border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 12, padding: 28, width: 380,
          }}>
            <div style={{ fontSize: 13, color: '#c0b8d8', fontWeight: 600, marginBottom: 4 }}>
              Ban user
            </div>
            <div style={{ fontSize: 12, color: '#5a5570', marginBottom: 20 }}>
              {banTarget.username}
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 10, letterSpacing: '0.08em', color: '#3d3a4e', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
                Reason (optional)
              </label>
              <input
                className="admin-input"
                style={{ width: '100%' }}
                placeholder="Spam, harassment, ..."
                value={banReason}
                onChange={(e) => setBanReason(e.target.value)}
              />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 10, letterSpacing: '0.08em', color: '#3d3a4e', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
                Ban until (leave blank for permanent)
              </label>
              <input
                type="datetime-local"
                className="admin-input"
                style={{ width: '100%' }}
                value={banUntil}
                onChange={(e) => setBanUntil(e.target.value)}
              />
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button className="action-btn" onClick={() => setBanTarget(null)}>Cancel</button>
              <button
                className="action-btn danger"
                style={{ borderColor: 'rgba(239,68,68,0.4)', color: '#ef4444' }}
                disabled={banMutation.isPending}
                onClick={() => banMutation.mutate({
                  id: banTarget.id,
                  reason: banReason,
                  bannedUntil: banUntil,
                })}
              >
                {banMutation.isPending ? 'Banning...' : 'Confirm ban'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
