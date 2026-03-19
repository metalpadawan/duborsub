// src/app/admin/logs/page.tsx
'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

const ACTION_COLORS: Record<string, string> = {
  BAN_USER: '#ef4444',
  UNBAN_USER: '#22c55e',
  DELETE_COMMENT: '#f97316',
  ADD_ANIME: '#7c3aed',
  UPDATE_ANIME: '#3b82f6',
  DELETE_ANIME: '#ef4444',
};

export default function AdminLogsPage() {
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-logs', page],
    queryFn: () => api.get('/admin/logs', { params: { page, limit: 30 } }).then((r) => r.data),
    refetchInterval: 30_000, // auto-refresh every 30s
  });

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <span style={{ fontSize: 11, color: '#3d3a4e' }}>
          {data?.pagination?.total ?? 0} total entries · auto-refreshes every 30s
        </span>
        <span style={{ fontSize: 10, letterSpacing: '0.06em', color: '#3d3a4e' }}>
          ● LIVE
        </span>
      </div>

      <div className="admin-table-wrap">
        <table>
          <thead>
            <tr>
              <th>Action</th>
              <th>Admin</th>
              <th>Target</th>
              <th>IP</th>
              <th>Metadata</th>
              <th>Time</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={6} style={{ textAlign: 'center', color: '#3d3a4e', padding: 32 }}>Loading...</td></tr>
            )}
            {data?.logs?.map((log: any) => (
              <tr key={log.id}>
                <td>
                  <span
                    className="badge"
                    style={{
                      color: ACTION_COLORS[log.action] ?? '#7070a0',
                      background: `${ACTION_COLORS[log.action] ?? '#7070a0'}18`,
                    }}
                  >
                    {log.action}
                  </span>
                </td>
                <td style={{ color: '#c0b8d8' }}>{log.admin?.username ?? '—'}</td>
                <td style={{ color: '#5a5570', fontFamily: 'monospace', fontSize: 11 }}>
                  {log.targetType && (
                    <span style={{ marginRight: 4, color: '#3d3a4e' }}>[{log.targetType}]</span>
                  )}
                  {log.targetId ? log.targetId.slice(0, 8) + '...' : '—'}
                </td>
                <td style={{ color: '#3d3a4e', fontFamily: 'monospace', fontSize: 11 }}>
                  {log.ipAddress ?? '—'}
                </td>
                <td style={{ fontSize: 11, color: '#5a5570', maxWidth: 200 }}>
                  {log.metadata
                    ? <span style={{ fontFamily: 'monospace' }}>
                        {Object.entries(log.metadata as Record<string, any>)
                          .filter(([, v]) => v !== null && v !== undefined)
                          .map(([k, v]) => `${k}: ${v}`)
                          .join(' · ')
                        }
                      </span>
                    : <span style={{ color: '#3d3a4e' }}>—</span>
                  }
                </td>
                <td style={{ color: '#3d3a4e', whiteSpace: 'nowrap', fontSize: 11 }}>
                  {new Date(log.createdAt).toLocaleString()}
                </td>
              </tr>
            ))}
            {!isLoading && !data?.logs?.length && (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', color: '#3d3a4e', padding: 32 }}>
                  No log entries yet
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {data?.pagination && data.pagination.pages > 1 && (
        <div style={{ display: 'flex', gap: 6, marginTop: 16, justifyContent: 'flex-end' }}>
          {Array.from({ length: Math.min(data.pagination.pages, 10) }, (_, i) => i + 1).map((p) => (
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
