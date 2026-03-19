// src/app/admin/layout.tsx
'use client';
import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/lib/auth.store';

const NAV = [
  { href: '/admin', label: 'Overview', icon: '◈' },
  { href: '/admin/users', label: 'Users', icon: '◎' },
  { href: '/admin/anime', label: 'Anime', icon: '⬡' },
  { href: '/admin/comments', label: 'Comments', icon: '◇' },
  { href: '/admin/logs', label: 'Audit Log', icon: '≡' },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isLoading && (!user || user.role !== 'admin')) {
      router.replace('/');
    }
  }, [user, isLoading, router]);

  if (isLoading || !user) return null;

  return (
    <div className="admin-shell">
      <style>{`
        .admin-shell {
          display: flex;
          min-height: 100vh;
          background: #07070d;
          font-family: 'DM Mono', 'Fira Code', monospace;
        }
        .admin-sidebar {
          width: 220px;
          flex-shrink: 0;
          border-right: 1px solid rgba(255,255,255,0.05);
          background: #0b0b14;
          display: flex;
          flex-direction: column;
          padding: 24px 0;
          position: sticky;
          top: 0;
          height: 100vh;
        }
        .admin-logo {
          padding: 0 20px 24px;
          border-bottom: 1px solid rgba(255,255,255,0.05);
          margin-bottom: 16px;
        }
        .admin-logo-text {
          font-size: 13px;
          font-weight: 600;
          letter-spacing: 0.1em;
          color: #e040b0;
          text-transform: uppercase;
        }
        .admin-logo-sub {
          font-size: 11px;
          color: #3d3a4e;
          margin-top: 2px;
        }
        .admin-nav-item {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 9px 20px;
          font-size: 12px;
          color: #5a5570;
          text-decoration: none;
          transition: all 0.15s;
          letter-spacing: 0.03em;
        }
        .admin-nav-item:hover { color: #c0b8d8; background: rgba(255,255,255,0.03); }
        .admin-nav-item.active { color: #e040b0; background: rgba(224,64,176,0.08); border-right: 2px solid #e040b0; }
        .admin-nav-icon { font-size: 14px; width: 18px; text-align: center; }
        .admin-main { flex: 1; overflow-x: hidden; }
        .admin-topbar {
          height: 52px;
          border-bottom: 1px solid rgba(255,255,255,0.05);
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 28px;
          background: #0b0b14;
          position: sticky;
          top: 0;
          z-index: 10;
        }
        .admin-page-title { font-size: 12px; letter-spacing: 0.08em; color: #5a5570; text-transform: uppercase; }
        .admin-user-pill {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 11px;
          color: #5a5570;
        }
        .admin-content { padding: 28px; }
        .stat-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 28px; }
        .stat-card {
          background: #0f0f1a;
          border: 1px solid rgba(255,255,255,0.05);
          border-radius: 10px;
          padding: 20px;
        }
        .stat-label { font-size: 10px; letter-spacing: 0.1em; color: #3d3a4e; text-transform: uppercase; margin-bottom: 8px; }
        .stat-value { font-size: 28px; font-weight: 600; color: #e8e4f8; letter-spacing: -0.02em; }
        .stat-delta { font-size: 11px; margin-top: 4px; color: #3d3a4e; }
        .admin-table-wrap {
          background: #0f0f1a;
          border: 1px solid rgba(255,255,255,0.05);
          border-radius: 10px;
          overflow: hidden;
        }
        .admin-table-header {
          padding: 14px 20px;
          border-bottom: 1px solid rgba(255,255,255,0.05);
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .admin-table-title { font-size: 11px; letter-spacing: 0.08em; color: #7a7490; text-transform: uppercase; }
        table { width: 100%; border-collapse: collapse; }
        th { padding: 10px 16px; text-align: left; font-size: 10px; letter-spacing: 0.1em; color: #3d3a4e; text-transform: uppercase; border-bottom: 1px solid rgba(255,255,255,0.04); }
        td { padding: 12px 16px; font-size: 12px; color: #8a85a0; border-bottom: 1px solid rgba(255,255,255,0.03); }
        tr:last-child td { border-bottom: none; }
        tr:hover td { background: rgba(255,255,255,0.015); }
        .badge {
          display: inline-block;
          padding: 2px 8px;
          border-radius: 4px;
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.05em;
          text-transform: uppercase;
        }
        .badge-admin { background: rgba(224,64,176,0.15); color: #e040b0; }
        .badge-user  { background: rgba(100,100,140,0.15); color: #7070a0; }
        .badge-banned { background: rgba(239,68,68,0.15); color: #ef4444; }
        .badge-ok { background: rgba(34,197,94,0.12); color: #22c55e; }
        .action-btn {
          padding: 4px 10px;
          border-radius: 5px;
          font-size: 10px;
          font-family: inherit;
          cursor: pointer;
          border: 1px solid rgba(255,255,255,0.08);
          background: transparent;
          color: #5a5570;
          transition: all 0.15s;
          letter-spacing: 0.04em;
        }
        .action-btn:hover { border-color: rgba(255,255,255,0.2); color: #c0b8d8; }
        .action-btn.danger:hover { border-color: rgba(239,68,68,0.4); color: #ef4444; }
        .action-btn.success:hover { border-color: rgba(34,197,94,0.4); color: #22c55e; }
        .admin-input {
          background: #07070d;
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 6px;
          padding: 7px 12px;
          font-size: 12px;
          font-family: inherit;
          color: #c0b8d8;
          outline: none;
          transition: border-color 0.15s;
        }
        .admin-input:focus { border-color: rgba(224,64,176,0.4); }
        .admin-input::placeholder { color: #3d3a4e; }
        @media (max-width: 768px) {
          .admin-sidebar { display: none; }
          .stat-grid { grid-template-columns: repeat(2,1fr); }
        }
      `}</style>

      {/* Sidebar */}
      <aside className="admin-sidebar">
        <div className="admin-logo">
          <div className="admin-logo-text">AniRate</div>
          <div className="admin-logo-sub">Admin Panel</div>
        </div>
        <nav>
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`admin-nav-item${pathname === item.href ? ' active' : ''}`}
            >
              <span className="admin-nav-icon">{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>
        <div style={{ marginTop: 'auto', padding: '0 20px' }}>
          <Link href="/" className="admin-nav-item" style={{ padding: '9px 0', fontSize: 11 }}>
            ← Back to site
          </Link>
        </div>
      </aside>

      {/* Main */}
      <div className="admin-main">
        <div className="admin-topbar">
          <span className="admin-page-title">
            {NAV.find((n) => n.href === pathname)?.label ?? 'Admin'}
          </span>
          <div className="admin-user-pill">
            <span style={{ color: '#e040b0' }}>●</span>
            {user.username}
          </div>
        </div>
        <div className="admin-content">{children}</div>
      </div>
    </div>
  );
}
