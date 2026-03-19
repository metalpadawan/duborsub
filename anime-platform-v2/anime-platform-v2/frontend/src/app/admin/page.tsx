// src/app/admin/page.tsx — Overview dashboard
'use client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

async function fetchDashboard() {
  const { data } = await api.get('/admin/dashboard');
  return data;
}

export default function AdminOverviewPage() {
  const { data, isLoading } = useQuery({ queryKey: ['admin-dashboard'], queryFn: fetchDashboard });

  if (isLoading) return <DashboardSkeleton />;

  const { counts, topRatedAnime, recentActivity } = data ?? {};

  return (
    <div>
      {/* Stat cards */}
      <div className="stat-grid">
        <StatCard label="Total Users"    value={counts?.totalUsers ?? 0}    delta="all time" />
        <StatCard label="Anime Titles"   value={counts?.totalAnime ?? 0}    delta="in catalog" />
        <StatCard label="Ratings Cast"   value={counts?.totalRatings ?? 0}  delta="sub + dub" />
        <StatCard label="Comments"       value={counts?.totalComments ?? 0} delta="active threads" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* Top rated anime */}
        <div className="admin-table-wrap">
          <div className="admin-table-header">
            <span className="admin-table-title">Top Rated Anime</span>
          </div>
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Title</th>
                <th>Sub</th>
                <th>Dub</th>
                <th>Votes</th>
              </tr>
            </thead>
            <tbody>
              {topRatedAnime?.map((a: any, i: number) => (
                <tr key={a.id}>
                  <td style={{ color: '#3d3a4e' }}>{i + 1}</td>
                  <td style={{ color: '#c0b8d8' }}>{a.title}</td>
                  <td style={{ color: '#f59e0b' }}>{a.avgSubRating ? Number(a.avgSubRating).toFixed(1) : '—'}</td>
                  <td style={{ color: '#f59e0b' }}>{a.avgDubRating ? Number(a.avgDubRating).toFixed(1) : '—'}</td>
                  <td>{a.totalVotes.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Recent admin activity */}
        <div className="admin-table-wrap">
          <div className="admin-table-header">
            <span className="admin-table-title">Recent Activity</span>
          </div>
          <table>
            <thead>
              <tr>
                <th>Action</th>
                <th>Admin</th>
                <th>Time</th>
              </tr>
            </thead>
            <tbody>
              {recentActivity?.map((log: any) => (
                <tr key={log.id}>
                  <td>
                    <span className={`badge ${actionColor(log.action)}`}>{log.action}</span>
                  </td>
                  <td>{log.admin?.username}</td>
                  <td style={{ color: '#3d3a4e' }}>{timeAgo(log.createdAt)}</td>
                </tr>
              ))}
              {!recentActivity?.length && (
                <tr><td colSpan={3} style={{ textAlign: 'center', color: '#3d3a4e' }}>No activity yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, delta }: { label: string; value: number; delta: string }) {
  return (
    <div className="stat-card">
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value.toLocaleString()}</div>
      <div className="stat-delta">{delta}</div>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div style={{ opacity: 0.4 }}>
      <div className="stat-grid">
        {[0,1,2,3].map(i => (
          <div key={i} className="stat-card" style={{ height: 88, background: '#0f0f1a' }} />
        ))}
      </div>
    </div>
  );
}

function actionColor(action: string) {
  if (action.includes('BAN')) return 'badge-banned';
  if (action.includes('DELETE')) return 'badge-banned';
  if (action.includes('UNBAN')) return 'badge-ok';
  return 'badge-user';
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}
