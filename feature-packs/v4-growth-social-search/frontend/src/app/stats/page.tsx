'use client';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { api } from '@/lib/api';

const fetchStats = () => api.get('/stats').then(r => r.data.data ?? r.data);

export default function StatsPage() {
  const { data, isLoading } = useQuery({ queryKey: ['stats'], queryFn: fetchStats });

  if (isLoading) return <StatsSkeleton />;

  const { global: g, genreBreakdown, top, trends } = data ?? {};
  const h2h = g?.headToHead;
  const h2hTotal = h2h ? h2h.subWins + h2h.dubWins + h2h.ties : 0;

  return (
    <main style={{ minHeight: '100vh', background: 'var(--bg-base)' }}>
      {/* Header */}
      <div style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-surface)' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '20px' }}>
          <Link href="/" style={{ fontSize: 13, color: 'var(--text-3)', textDecoration: 'none' }}>← Catalog</Link>
          <h1 style={{ fontSize: 26, fontWeight: 700, color: 'var(--text-1)', margin: '8px 0 4px' }}>
            Sub vs Dub — Global Stats
          </h1>
          <p style={{ fontSize: 14, color: 'var(--text-3)', margin: 0 }}>
            {g?.totalRatings?.toLocaleString()} ratings from {g?.totalUsers?.toLocaleString()} users
          </p>
        </div>
      </div>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '28px 20px' }}>

        {/* Head-to-head hero */}
        <div className="card" style={{ padding: '28px 32px', marginBottom: 28 }}>
          <h2 style={{ fontSize: 13, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: 20 }}>
            Head-to-head — when users rate both versions
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: 24 }}>
            {/* Sub side */}
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 48, fontWeight: 800, color: '#3b82f6', letterSpacing: '-0.03em' }}>
                {h2hTotal ? Math.round((h2h!.subWins / h2hTotal) * 100) : 0}%
              </div>
              <div style={{ fontSize: 14, color: 'var(--text-2)', marginTop: 4 }}>Sub wins</div>
              <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{h2h?.subWins?.toLocaleString()} cases</div>
            </div>
            {/* VS bar */}
            <div style={{ minWidth: 180 }}>
              <div style={{ height: 12, borderRadius: 6, background: 'var(--bg-hover)', overflow: 'hidden', display: 'flex' }}>
                {h2hTotal > 0 && <>
                  <div style={{ width: `${(h2h!.subWins / h2hTotal) * 100}%`, background: '#3b82f6', transition: 'width 1s ease' }} />
                  <div style={{ width: `${(h2h!.ties / h2hTotal) * 100}%`, background: 'var(--text-3)' }} />
                  <div style={{ width: `${(h2h!.dubWins / h2hTotal) * 100}%`, background: 'var(--accent)' }} />
                </>}
              </div>
              <div style={{ display: 'flex', justifyContent: 'center', marginTop: 8, fontSize: 11, color: 'var(--text-3)' }}>
                {h2h?.ties?.toLocaleString()} ties
              </div>
            </div>
            {/* Dub side */}
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 48, fontWeight: 800, color: 'var(--accent)', letterSpacing: '-0.03em' }}>
                {h2hTotal ? Math.round((h2h!.dubWins / h2hTotal) * 100) : 0}%
              </div>
              <div style={{ fontSize: 14, color: 'var(--text-2)', marginTop: 4 }}>Dub wins</div>
              <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{h2h?.dubWins?.toLocaleString()} cases</div>
            </div>
          </div>

          {/* Average rating comparison */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginTop: 28, paddingTop: 20, borderTop: '1px solid var(--border)' }}>
            {[
              { label: 'Sub average', value: g?.sub?.avgRating, color: '#3b82f6', count: g?.sub?.totalRatings, dist: g?.sub?.distribution },
              { label: 'Dub average', value: g?.dub?.avgRating, color: '#e040b0', count: g?.dub?.totalRatings, dist: g?.dub?.distribution },
            ].map(({ label, value, color, count, dist }) => (
              <div key={label}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
                  <span style={{ fontSize: 13, color: 'var(--text-2)' }}>{label}</span>
                  <span style={{ fontSize: 24, fontWeight: 700, color }}>{value ?? '—'}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {[5,4,3,2,1].map(star => {
                    const d = dist?.find((x: any) => x.star === star);
                    const total = dist?.reduce((s: number, x: any) => s + x.count, 0) ?? 0;
                    const pct = total && d ? (d.count / total) * 100 : 0;
                    return (
                      <div key={star} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 11, color: 'var(--text-3)', width: 8 }}>{star}</span>
                        <div style={{ flex: 1, height: 6, borderRadius: 3, background: 'var(--bg-hover)', overflow: 'hidden' }}>
                          <div style={{ width: `${pct}%`, height: '100%', borderRadius: 3, background: color, transition: 'width 0.8s ease' }} />
                        </div>
                        <span style={{ fontSize: 11, color: 'var(--text-3)', width: 28, textAlign: 'right' }}>{d?.count?.toLocaleString() ?? 0}</span>
                      </div>
                    );
                  })}
                </div>
                <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 8 }}>{count?.toLocaleString()} ratings</p>
              </div>
            ))}
          </div>
        </div>

        {/* Genre breakdown */}
        <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-1)', marginBottom: 16 }}>By genre</h2>
        <div className="card" style={{ marginBottom: 28, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Genre', 'Sub avg', 'Dub avg', 'Winner', 'Anime', 'Votes'].map(h => (
                  <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-3)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {genreBreakdown?.map((g: any) => (
                <tr key={g.genre} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <td style={{ padding: '11px 16px', fontSize: 13, color: 'var(--text-1)', fontWeight: 500 }}>{g.genre}</td>
                  <td style={{ padding: '11px 16px', fontSize: 13, color: '#3b82f6' }}>{g.avgSub ?? '—'}</td>
                  <td style={{ padding: '11px 16px', fontSize: 13, color: '#e040b0' }}>{g.avgDub ?? '—'}</td>
                  <td style={{ padding: '11px 16px' }}>
                    {g.winner ? (
                      <span style={{
                        fontSize: 11, padding: '2px 8px', borderRadius: 4, fontWeight: 600,
                        background: g.winner === 'sub' ? 'rgba(59,130,246,0.15)' : g.winner === 'dub' ? 'rgba(224,64,176,0.15)' : 'var(--bg-hover)',
                        color: g.winner === 'sub' ? '#3b82f6' : g.winner === 'dub' ? '#e040b0' : 'var(--text-3)',
                      }}>
                        {g.winner === 'tie' ? 'Tie' : g.winner.toUpperCase()}
                      </span>
                    ) : '—'}
                  </td>
                  <td style={{ padding: '11px 16px', fontSize: 13, color: 'var(--text-3)' }}>{g.animeCount}</td>
                  <td style={{ padding: '11px 16px', fontSize: 13, color: 'var(--text-3)' }}>{g.totalVotes?.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Top lists */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 28 }}>
          <TopList title="Top rated — Sub" items={top?.topSub} scoreKey="avgSubRating" color="#3b82f6" label="Sub" />
          <TopList title="Top rated — Dub" items={top?.topDub} scoreKey="avgDubRating" color="#e040b0" label="Dub" />
          <TopList title="Biggest sub/dub divide" items={top?.mostControversial} scoreKey="gap" color="#f59e0b" label="Gap" />
          <TopList title="Best dub upgrade" items={top?.bestDubUpgrade} scoreKey="dubImprovement" color="#22c55e" label="+Dub" />
        </div>

        {/* Monthly trends */}
        {trends?.length > 0 && (
          <>
            <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-1)', marginBottom: 16 }}>Rating activity — last 12 months</h2>
            <div className="card" style={{ padding: '24px 20px' }}>
              <TrendsChart trends={trends} />
            </div>
          </>
        )}
      </div>
    </main>
  );
}

function TopList({ title, items, scoreKey, color, label }: any) {
  return (
    <div className="card" style={{ overflow: 'hidden' }}>
      <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', fontSize: 13, fontWeight: 600, color: 'var(--text-2)' }}>{title}</div>
      {items?.map((a: any, i: number) => (
        <Link key={a.id} href={`/anime/${a.id}`} style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
          <span style={{ fontSize: 12, color: 'var(--text-3)', width: 18 }}>{i + 1}</span>
          <span style={{ flex: 1, fontSize: 13, color: 'var(--text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.title}</span>
          <span style={{ fontSize: 13, fontWeight: 600, color, flexShrink: 0 }}>
            {label} {Number(a[scoreKey]).toFixed(1)}
          </span>
        </Link>
      ))}
    </div>
  );
}

function TrendsChart({ trends }: { trends: any[] }) {
  const maxVal = Math.max(...trends.map((t: any) => Math.max(t.subCount, t.dubCount)));
  const barW = Math.floor(620 / (trends.length * 2 + trends.length + 1));

  return (
    <div style={{ overflowX: 'auto' }}>
      <svg width="100%" viewBox={`0 0 640 180`} style={{ display: 'block' }}>
        {trends.map((t: any, i: number) => {
          const x = 20 + i * (barW * 2 + barW / 2 + 4);
          const subH = maxVal ? (t.subCount / maxVal) * 130 : 0;
          const dubH = maxVal ? (t.dubCount / maxVal) * 130 : 0;
          return (
            <g key={t.month}>
              <rect x={x} y={150 - subH} width={barW} height={subH} fill="#3b82f6" opacity={0.8} rx={2} />
              <rect x={x + barW + 2} y={150 - dubH} width={barW} height={dubH} fill="#e040b0" opacity={0.8} rx={2} />
              <text x={x + barW} y={168} textAnchor="middle" style={{ fontSize: 9, fill: 'var(--color-text-tertiary)' }}>
                {t.month.slice(5)}
              </text>
            </g>
          );
        })}
      </svg>
      <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginTop: 8 }}>
        {[{ color: '#3b82f6', label: 'Sub ratings' }, { color: '#e040b0', label: 'Dub ratings' }].map(({ color, label }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-3)' }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: color, display: 'inline-block' }} />
            {label}
          </div>
        ))}
      </div>
    </div>
  );
}

function StatsSkeleton() {
  return (
    <main style={{ minHeight: '100vh', background: 'var(--bg-base)' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: 28 }}>
        {[200, 300, 400].map(h => (
          <div key={h} className="card animate-pulse" style={{ height: h, marginBottom: 20 }} />
        ))}
      </div>
    </main>
  );
}
