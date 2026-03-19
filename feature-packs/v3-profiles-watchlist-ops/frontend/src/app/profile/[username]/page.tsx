'use client';
import { useQuery } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { api } from '@/lib/api';

// ── Data fetchers ─────────────────────────────────────────────
const fetchProfile = (u: string) => api.get(`/users/${u}`).then(r => r.data.data ?? r.data);
const fetchStats   = (u: string) => api.get(`/users/${u}/stats`).then(r => r.data.data ?? r.data);
const fetchRatings = (u: string, page: number) =>
  api.get(`/users/${u}/ratings`, { params: { page, limit: 12 } }).then(r => r.data.data ?? r.data);
const fetchComments = (u: string, page: number) =>
  api.get(`/users/${u}/comments`, { params: { page, limit: 10 } }).then(r => r.data.data ?? r.data);

const STATUS_LABEL: Record<string, string> = {
  plan_to_watch: 'Plan to watch', watching: 'Watching',
  completed: 'Completed', dropped: 'Dropped', on_hold: 'On hold',
};

export default function ProfilePage() {
  const { username } = useParams<{ username: string }>();

  const { data: profile, isLoading: loadingProfile } = useQuery({
    queryKey: ['profile', username],
    queryFn: () => fetchProfile(username),
  });

  const { data: stats } = useQuery({
    queryKey: ['profile-stats', username],
    queryFn: () => fetchStats(username),
    enabled: !!profile,
  });

  const { data: ratings } = useQuery({
    queryKey: ['profile-ratings', username, 1],
    queryFn: () => fetchRatings(username, 1),
    enabled: !!profile,
  });

  const { data: comments } = useQuery({
    queryKey: ['profile-comments', username, 1],
    queryFn: () => fetchComments(username, 1),
    enabled: !!profile,
  });

  if (loadingProfile) return <ProfileSkeleton />;
  if (!profile) return (
    <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-base)' }}>
      <p style={{ color: 'var(--text-3)' }}>User not found</p>
    </main>
  );

  return (
    <main style={{ minHeight: '100vh', background: 'var(--bg-base)' }}>
      {/* Header */}
      <div style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-surface)' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 20px', display: 'flex', alignItems: 'center', gap: 20 }}>
          {/* Avatar */}
          <div style={{
            width: 72, height: 72, borderRadius: '50%', flexShrink: 0,
            background: 'linear-gradient(135deg, var(--accent), #7c3aed)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 28, fontWeight: 700, color: '#fff',
          }}>
            {profile.username[0].toUpperCase()}
          </div>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-1)', margin: 0 }}>
              {profile.username}
            </h1>
            <p style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 4 }}>
              Joined {new Date(profile.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              {' · '}{profile._count?.ratings ?? 0} ratings
              {' · '}{profile._count?.comments ?? 0} comments
            </p>
          </div>
          {profile.role === 'admin' && (
            <span style={{ marginLeft: 'auto', fontSize: 11, padding: '3px 10px', borderRadius: 20, background: 'rgba(224,64,176,0.15)', color: 'var(--accent)', border: '1px solid rgba(224,64,176,0.3)' }}>
              Admin
            </span>
          )}
        </div>
      </div>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '28px 20px', display: 'grid', gridTemplateColumns: '1fr 320px', gap: 28 }}>

        {/* Left — ratings history */}
        <div>
          <h2 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-2)', marginBottom: 16, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
            Rating history
          </h2>
          {ratings?.items?.length === 0 ? (
            <p style={{ color: 'var(--text-3)', fontSize: 14 }}>No ratings yet.</p>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12 }}>
              {ratings?.items?.map((r: any) => (
                <Link key={r.id} href={`/anime/${r.anime.id}`} style={{ textDecoration: 'none' }}>
                  <div className="card" style={{ padding: 0, overflow: 'hidden', transition: 'transform 0.15s' }}
                    onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-2px)')}
                    onMouseLeave={e => (e.currentTarget.style.transform = '')}>
                    <div style={{ position: 'relative', aspectRatio: '2/3', background: 'var(--bg-hover)' }}>
                      {r.anime.coverImageUrl ? (
                        <Image src={r.anime.coverImageUrl} alt={r.anime.title} fill style={{ objectFit: 'cover' }} sizes="180px" />
                      ) : (
                        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, color: 'var(--text-3)' }}>⛩</div>
                      )}
                    </div>
                    <div style={{ padding: '10px 12px' }}>
                      <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-1)', marginBottom: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.anime.title}</p>
                      <div style={{ display: 'flex', gap: 8 }}>
                        {r.subRating && (
                          <span style={{ fontSize: 11, color: '#f59e0b' }}>Sub ★{r.subRating}</span>
                        )}
                        {r.dubRating && (
                          <span style={{ fontSize: 11, color: 'var(--accent)' }}>Dub ★{r.dubRating}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}

          {/* Comments */}
          <h2 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-2)', margin: '32px 0 16px', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
            Recent comments
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {comments?.items?.map((c: any) => (
              <Link key={c.id} href={`/anime/${c.anime.id}`} style={{ textDecoration: 'none' }}>
                <div className="card" style={{ padding: '12px 16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontSize: 12, color: 'var(--accent)' }}>{c.anime.title}</span>
                    <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{new Date(c.createdAt).toLocaleDateString()}</span>
                  </div>
                  <p style={{ fontSize: 13, color: 'var(--text-2)', margin: 0, lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {c.content}
                  </p>
                </div>
              </Link>
            ))}
            {comments?.items?.length === 0 && (
              <p style={{ color: 'var(--text-3)', fontSize: 14 }}>No comments yet.</p>
            )}
          </div>
        </div>

        {/* Right — stats sidebar */}
        <div>
          <h2 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-2)', marginBottom: 16, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
            Sub vs Dub preference
          </h2>

          {stats && stats.totalBoth > 0 ? (
            <div className="card" style={{ padding: '20px' }}>
              {/* Preference badge */}
              <div style={{ textAlign: 'center', marginBottom: 20 }}>
                <span style={{
                  display: 'inline-block', padding: '6px 20px', borderRadius: 20, fontSize: 13, fontWeight: 700,
                  background: stats.preference === 'sub' ? 'rgba(59,130,246,0.15)' : stats.preference === 'dub' ? 'rgba(224,64,176,0.15)' : 'var(--bg-hover)',
                  color: stats.preference === 'sub' ? '#3b82f6' : stats.preference === 'dub' ? 'var(--accent)' : 'var(--text-2)',
                  border: `1px solid ${stats.preference === 'sub' ? 'rgba(59,130,246,0.3)' : stats.preference === 'dub' ? 'rgba(224,64,176,0.3)' : 'var(--border)'}`,
                }}>
                  {stats.preference === 'balanced' ? 'Balanced viewer' : `Prefers ${stats.preference.toUpperCase()}`}
                </span>
              </div>

              {/* Win bars */}
              <div style={{ marginBottom: 16 }}>
                {[
                  { label: 'Sub wins', value: stats.subWins, color: '#3b82f6', avg: stats.avgSub },
                  { label: 'Dub wins', value: stats.dubWins, color: '#e040b0', avg: stats.avgDub },
                  { label: 'Ties', value: stats.ties, color: 'var(--text-3)', avg: null },
                ].map(({ label, value, color, avg }) => (
                  <div key={label} style={{ marginBottom: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{label}</span>
                      <span style={{ fontSize: 12, color: 'var(--text-2)' }}>
                        {value} {avg ? `· avg ${avg}` : ''}
                      </span>
                    </div>
                    <div style={{ height: 6, borderRadius: 3, background: 'var(--bg-hover)', overflow: 'hidden' }}>
                      <div style={{
                        height: '100%', borderRadius: 3, background: color,
                        width: stats.totalBoth ? `${(value / stats.totalBoth) * 100}%` : '0%',
                        transition: 'width 0.5s ease',
                      }} />
                    </div>
                  </div>
                ))}
              </div>

              {/* Star distribution */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 16 }}>
                {[
                  { label: 'Sub ratings', dist: stats.subDist, color: '#3b82f6' },
                  { label: 'Dub ratings', dist: stats.dubDist, color: '#e040b0' },
                ].map(({ label, dist, color }) => (
                  <div key={label}>
                    <p style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 8, textAlign: 'center' }}>{label}</p>
                    {dist?.map((d: any) => (
                      <div key={d.star} style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 3 }}>
                        <span style={{ fontSize: 10, color: 'var(--text-3)', width: 8 }}>{d.star}</span>
                        <div style={{ flex: 1, height: 4, borderRadius: 2, background: 'var(--bg-hover)', overflow: 'hidden' }}>
                          <div style={{
                            height: '100%', borderRadius: 2, background: color,
                            width: dist.reduce((s: number, x: any) => s + x.count, 0)
                              ? `${(d.count / dist.reduce((s: number, x: any) => s + x.count, 0)) * 100}%`
                              : '0%',
                          }} />
                        </div>
                        <span style={{ fontSize: 10, color: 'var(--text-3)', width: 16, textAlign: 'right' }}>{d.count}</span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="card" style={{ padding: 20, textAlign: 'center' }}>
              <p style={{ color: 'var(--text-3)', fontSize: 13 }}>
                Rate anime with both sub and dub scores to see your preference breakdown.
              </p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

function ProfileSkeleton() {
  return (
    <main style={{ minHeight: '100vh', background: 'var(--bg-base)' }}>
      <div style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-surface)', padding: '24px 20px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', gap: 20, alignItems: 'center' }}>
          <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'var(--bg-card)' }} className="animate-pulse" />
          <div style={{ flex: 1 }}>
            <div style={{ height: 22, width: 160, borderRadius: 4, background: 'var(--bg-card)', marginBottom: 8 }} className="animate-pulse" />
            <div style={{ height: 14, width: 240, borderRadius: 4, background: 'var(--bg-card)' }} className="animate-pulse" />
          </div>
        </div>
      </div>
    </main>
  );
}
