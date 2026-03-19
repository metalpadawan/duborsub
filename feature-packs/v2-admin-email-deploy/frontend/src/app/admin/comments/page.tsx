// src/app/admin/comments/page.tsx
'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

// Fetch all recent comments (admin view — across all anime)
async function fetchRecentComments(page: number) {
  // We call the admin-specific comments endpoint if available,
  // or fall back to listing anime then their comments.
  // For now we fetch from the comments aggregate view via admin logs context.
  const { data } = await api.get('/admin/comments', { params: { page, limit: 30 } });
  return data;
}

export default function AdminCommentsPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-comments', page],
    queryFn: () => fetchRecentComments(page),
    placeholderData: (p) => p,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/comments/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-comments'] }),
  });

  return (
    <div>
      <div style={{ marginBottom: 16, fontSize: 11, color: '#3d3a4e' }}>
        {data?.pagination?.total ?? 0} active comments
      </div>
      <div className="admin-table-wrap">
        <table>
          <thead>
            <tr>
              <th>User</th>
              <th>Anime</th>
              <th>Comment</th>
              <th>Posted</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={5} style={{ textAlign: 'center', color: '#3d3a4e', padding: 32 }}>Loading...</td></tr>
            )}
            {data?.comments?.map((c: any) => (
              <tr key={c.id}>
                <td style={{ color: '#c0b8d8', whiteSpace: 'nowrap' }}>{c.user?.username ?? '—'}</td>
                <td style={{ color: '#5a5570', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {c.anime?.title ?? c.animeId}
                </td>
                <td style={{ maxWidth: 320 }}>
                  <span style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {c.content}
                  </span>
                </td>
                <td style={{ color: '#3d3a4e', whiteSpace: 'nowrap' }}>
                  {new Date(c.createdAt).toLocaleDateString()}
                </td>
                <td>
                  <button
                    className="action-btn danger"
                    onClick={() => { if (confirm('Remove this comment?')) deleteMutation.mutate(c.id); }}
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
            {!isLoading && !data?.comments?.length && (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', color: '#3d3a4e', padding: 32 }}>
                  No comments to moderate
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {data?.pagination && data.pagination.pages > 1 && (
        <div style={{ display: 'flex', gap: 6, marginTop: 16, justifyContent: 'flex-end' }}>
          {Array.from({ length: data.pagination.pages }, (_, i) => i + 1).map((p) => (
            <button key={p} className="action-btn" onClick={() => setPage(p)}
              style={{ color: p === page ? '#e040b0' : undefined, borderColor: p === page ? 'rgba(224,64,176,0.3)' : undefined }}>
              {p}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// src/app/admin/logs/page.tsx — Audit log viewer
// ─────────────────────────────────────────────────────────────
// (exported from same file for colocation — split into separate files if preferred)
