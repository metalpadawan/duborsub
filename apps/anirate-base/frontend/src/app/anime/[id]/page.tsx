'use client';

// The detail page combines the three main interactive surfaces of the app:
// anime metadata, personal ratings, and the discussion thread.
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { SiteHeader } from '@/components/SiteHeader';
import { Providers } from '@/app/providers';
import { animeApi, commentsApi, ratingsApi } from '@/lib/api';
import { useAuthStore } from '@/lib/auth.store';

export default function AnimeDetailPage() {
  return (
    <Providers>
      <AnimeDetailContent />
    </Providers>
  );
}

function AnimeDetailContent() {
  const params = useParams<{ id: string }>();
  const animeId = params?.id ?? '';
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [commentText, setCommentText] = useState('');

  const animeQuery = useQuery({
    // The page is anchored around the anime payload, so this query owns the primary loading state.
    queryKey: ['anime', animeId],
    queryFn: async () => {
      const response = await animeApi.get(animeId);
      return response.data;
    },
  });

  const myRatingQuery = useQuery({
    // Personal rating data is only relevant when someone is signed in.
    queryKey: ['rating', animeId],
    queryFn: async () => {
      const response = await ratingsApi.mine(animeId);
      return response.data as { subRating?: number | null; dubRating?: number | null };
    },
    enabled: Boolean(user),
  });

  const commentsQuery = useQuery({
    queryKey: ['comments', animeId],
    queryFn: async () => {
      const response = await commentsApi.list(animeId, { page: 1, limit: 20 });
      return response.data;
    },
  });

  const ratingMutation = useMutation({
    mutationFn: (payload: { subRating?: number; dubRating?: number }) => ratingsApi.upsert(animeId, payload),
    onSuccess: () => {
      // Revalidate both the anime aggregate view and the user's personal rating badge.
      queryClient.invalidateQueries({ queryKey: ['anime', animeId] });
      queryClient.invalidateQueries({ queryKey: ['rating', animeId] });
    },
  });

  const postCommentMutation = useMutation({
    mutationFn: () => commentsApi.create(animeId, { content: commentText }),
    onSuccess: () => {
      setCommentText('');
      // Refresh the thread after posting so the new comment appears in chronological context.
      queryClient.invalidateQueries({ queryKey: ['comments', animeId] });
    },
  });

  const deleteCommentMutation = useMutation({
    mutationFn: (commentId: string) => commentsApi.delete(animeId, commentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comments', animeId] });
    },
  });

  if (animeQuery.isLoading) {
    return (
      <main className="min-h-screen" style={{ background: 'var(--bg-base)' }}>
        <SiteHeader />
        {/* Keep the layout shell visible during loading so the route change feels stable. */}
        <div className="max-w-5xl mx-auto px-4 py-10 animate-pulse">
          <div className="h-10 w-56 rounded mb-4" style={{ background: 'var(--bg-card)' }} />
          <div className="h-4 w-96 rounded" style={{ background: 'var(--bg-card)' }} />
        </div>
      </main>
    );
  }

  const anime = animeQuery.data;
  if (!anime) {
    // Only a 404 means the anime is missing; anything else is a failed request and
    // should not be reported as "not found".
    const status = (animeQuery.error as { response?: { status?: number } } | null)?.response?.status;
    const message =
      !animeQuery.error || status === 404
        ? 'Anime not found.'
        : 'Could not load this anime right now. Please try again shortly.';

    return (
      <main className="min-h-screen" style={{ background: 'var(--bg-base)' }}>
        <SiteHeader />
        <div className="max-w-5xl mx-auto px-4 py-10" style={{ color: 'var(--text-3)' }}>
          {message}
        </div>
      </main>
    );
  }
  const subAvg = anime.avgSubRating ? anime.avgSubRating.toFixed(1) : '-';
  const dubAvg = anime.avgDubRating ? anime.avgDubRating.toFixed(1) : '-';
  const scoreGap =
    anime.avgSubRating && anime.avgDubRating ? (Number(anime.avgDubRating) - Number(anime.avgSubRating)).toFixed(1) : null;

  return (
    <main
      className="min-h-screen"
      style={{
        background:
          'radial-gradient(circle at 10% 0%, color-mix(in oklch, var(--accent-alt) 20%, transparent), transparent 26rem), var(--bg-base)',
      }}
    >
      <SiteHeader />

      <section className="max-w-7xl mx-auto px-4 py-8">
        <Link href="/" className="inline-flex min-h-11 items-center text-sm font-semibold" style={{ color: 'var(--text-3)' }}>
          Back to database
        </Link>

        <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1.25fr)_360px]">
          <div>
            <div className="card overflow-hidden">
              <div
                className="p-5 sm:p-7"
                style={{
                  background:
                    'linear-gradient(135deg, color-mix(in oklch, var(--accent-alt) 18%, transparent), transparent 42%), var(--bg-card)',
                }}
              >
                <div className="flex flex-wrap gap-2 mb-4">
                  {anime.genres.map((genre) => (
                    <span
                      key={genre.id}
                      className="rounded-full px-3 py-1 text-xs font-bold"
                      style={{
                        background: 'color-mix(in oklch, var(--accent) 12%, var(--bg-hover))',
                        color: 'var(--accent)',
                        border: '1px solid color-mix(in oklch, var(--accent) 46%, var(--border))',
                      }}
                    >
                      {genre.name}
                    </span>
                  ))}
                </div>

                <p className="data-label">Anime report</p>
                <h1 className="mt-2 text-5xl font-black tracking-[-0.045em] sm:text-6xl" style={{ color: 'var(--text-1)' }}>
                  {anime.title}
                </h1>
                <p className="mt-4 max-w-3xl text-base leading-7" style={{ color: 'var(--text-2)' }}>
                  {anime.description || 'No description yet.'}
                </p>
              </div>
            </div>

            <div className="grid sm:grid-cols-4 gap-3 mt-5">
              <StatCard label="Sub Avg" value={subAvg} />
              <StatCard label="Dub Avg" value={dubAvg} />
              <StatCard label="Gap" value={scoreGap ? `${Number(scoreGap) > 0 ? '+' : ''}${scoreGap}` : '-'} />
              <StatCard label="Votes" value={String(anime.totalVotes)} />
            </div>

            <div className="card p-5 mt-8">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="data-label">Community input</p>
                  <h2 className="mt-1 text-xl font-black" style={{ color: 'var(--text-1)' }}>
                    Rate the version
                  </h2>
                  <p className="text-sm mt-1" style={{ color: 'var(--text-3)' }}>
                    Split ratings make the sub/dub comparison useful instead of averaging away the difference.
                  </p>
                </div>
                <span
                  className="rounded-lg px-3 py-2 text-xs font-black"
                  style={{
                    background: anime.hasDub ? 'color-mix(in oklch, var(--accent) 14%, transparent)' : 'var(--bg-hover)',
                    color: anime.hasDub ? 'var(--accent)' : 'var(--text-3)',
                    border: '1px solid var(--border)',
                  }}
                >
                  {anime.hasDub ? 'SUB/DUB READY' : 'SUB ONLY'}
                </span>
              </div>

              {user ? (
                // Ratings stay split so sub and dub opinions can diverge naturally.
                <div className="grid sm:grid-cols-2 gap-4 mt-5">
                  <RatingPanel
                    label="Sub"
                    currentValue={myRatingQuery.data?.subRating ?? null}
                    onRate={(value) => ratingMutation.mutate({ subRating: value })}
                  />
                  {anime.hasDub ? (
                    <RatingPanel
                      label="Dub"
                      currentValue={myRatingQuery.data?.dubRating ?? null}
                      onRate={(value) => ratingMutation.mutate({ dubRating: value })}
                    />
                  ) : null}
                </div>
              ) : (
                <p className="text-sm mt-5" style={{ color: 'var(--text-3)' }}>
                  <Link href="/login" style={{ color: 'var(--accent)' }}>
                    Sign in
                  </Link>{' '}
                  to rate this anime.
                </p>
              )}
            </div>
          </div>

          <aside className="card h-fit p-5 lg:sticky lg:top-24">
            <p className="data-label">Scouting panel</p>
            <h2 className="mt-1 text-lg font-black" style={{ color: 'var(--text-1)' }}>
              Details
            </h2>
            <dl className="mt-4 grid gap-3 text-sm">
              <DetailRow label="Status" value={anime.status} />
              <DetailRow label="Year" value={String(anime.releaseYear ?? '-')} />
              <DetailRow label="Dub available" value={anime.hasDub ? 'Yes' : 'No'} />
              <DetailRow label="Community votes" value={String(anime.totalVotes)} />
            </dl>
            <div className="mt-5 rounded-xl border p-4" style={{ borderColor: 'var(--border)', background: 'var(--bg-surface)' }}>
              <p className="text-xs font-bold uppercase tracking-[0.14em]" style={{ color: 'var(--text-3)' }}>
                Read recommendation
              </p>
              <p className="mt-2 text-sm leading-6" style={{ color: 'var(--text-2)' }}>
                {scoreGap
                  ? Number(scoreGap) > 0
                    ? 'Dub score is currently ahead. Check comments before choosing.'
                    : 'Sub score is currently ahead. Dub may still be useful for casual watching.'
                  : 'Not enough split-score data yet. Add your rating to improve the report.'}
              </p>
            </div>
          </aside>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 pb-12">
        <div className="card p-5">
          <p className="data-label">Community notes</p>
          <h2 className="mt-1 text-xl font-black" style={{ color: 'var(--text-1)' }}>
            Discussion
          </h2>

          {user ? (
            <div className="mt-4">
              <textarea
                className="input resize-none"
                rows={3}
                value={commentText}
                placeholder="Share your thoughts..."
                onChange={(event) => setCommentText(event.target.value)}
              />
              <div className="flex justify-end mt-3">
                <button
                  className="btn-primary"
                  disabled={!commentText.trim() || postCommentMutation.isPending}
                  onClick={() => postCommentMutation.mutate()}
                >
                  {postCommentMutation.isPending ? 'Posting...' : 'Post comment'}
                </button>
              </div>
            </div>
          ) : (
            <p className="text-sm mt-4" style={{ color: 'var(--text-3)' }}>
              <Link href="/login" style={{ color: 'var(--accent)' }}>
                Sign in
              </Link>{' '}
              to join the discussion.
            </p>
          )}

          <div className="mt-6 space-y-4">
            {commentsQuery.data?.items.map((comment) => (
              <article key={comment.id} className="rounded-xl border p-4" style={{ borderColor: 'var(--border)', background: 'var(--bg-surface)' }}>
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium" style={{ color: 'var(--text-1)' }}>
                      {comment.user?.username ?? 'Unknown user'}
                    </p>
                    <p className="text-xs" style={{ color: 'var(--text-3)' }}>
                      {new Date(comment.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <span className="text-xs" style={{ color: 'var(--text-3)' }}>
                    Score: {comment._count.likes}
                  </span>
                </div>

                <p className="text-sm mt-3" style={{ color: 'var(--text-2)' }}>
                  {comment.content}
                </p>

                {user && comment.user && user.id === comment.user.id ? (
                  <div className="flex justify-end mt-3">
                    <button
                      className="text-xs"
                      style={{ color: '#ef4444' }}
                      onClick={() => deleteCommentMutation.mutate(comment.id)}
                    >
                      Delete
                    </button>
                  </div>
                ) : null}

                {comment.replies.length > 0 ? (
                  // Replies are already nested by the API, so the UI only needs a lightweight indent.
                  <div className="mt-4 pl-4 border-l space-y-3" style={{ borderColor: 'var(--border)' }}>
                    {comment.replies.map((reply) => (
                      <div key={reply.id}>
                        <p className="text-xs font-medium" style={{ color: 'var(--text-1)' }}>
                          {reply.user?.username ?? 'Unknown user'}
                        </p>
                        <p className="text-sm mt-1" style={{ color: 'var(--text-2)' }}>
                          {reply.content}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="card p-4">
      <p className="text-xs font-black uppercase tracking-[0.16em]" style={{ color: 'var(--text-3)' }}>
        {label}
      </p>
      <p className="mt-2 text-3xl font-black leading-none" style={{ color: 'var(--text-1)' }}>
        {value}
      </p>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="flex items-center justify-between gap-4 rounded-lg border px-3 py-3"
      style={{ borderColor: 'var(--border)', background: 'var(--bg-surface)' }}
    >
      <dt className="text-xs font-bold uppercase tracking-[0.14em]" style={{ color: 'var(--text-3)' }}>
        {label}
      </dt>
      <dd className="text-sm font-black" style={{ color: 'var(--text-1)' }}>
        {value}
      </dd>
    </div>
  );
}

function RatingPanel({
  label,
  currentValue,
  onRate,
}: {
  label: string;
  currentValue: number | null;
  onRate: (value: number) => void;
}) {
  return (
    <div className="card p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-black" style={{ color: 'var(--text-1)' }}>
          {label}
        </p>
        <p className="rounded-md px-2 py-1 text-xs font-black" style={{ background: 'var(--bg-hover)', color: 'var(--text-2)' }}>
          {currentValue ?? '-'} / 5
        </p>
      </div>
      {/* The selected value is highlighted so a returning user can see their current vote at a glance. */}
      <div className="grid grid-cols-5 gap-2 mt-4">
        {[1, 2, 3, 4, 5].map((value) => (
          <button
            key={value}
            className="min-h-11 rounded-lg text-sm font-black transition-transform active:scale-95"
            style={{
              background: currentValue === value ? 'var(--accent)' : 'var(--bg-hover)',
              color: currentValue === value ? 'var(--bg-base)' : 'var(--text-2)',
              border: '1px solid var(--border)',
            }}
            onClick={() => onRate(value)}
          >
            {value}
          </button>
        ))}
      </div>
    </div>
  );
}
