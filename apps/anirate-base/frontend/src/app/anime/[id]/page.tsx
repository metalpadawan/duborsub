'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { SiteHeader } from '@/components/SiteHeader';
import { animeApi, commentsApi, ratingsApi } from '@/lib/api';
import { useAuthStore } from '@/lib/auth.store';

export default function AnimeDetailPage() {
  const params = useParams<{ id: string }>();
  const animeId = params.id;
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [commentText, setCommentText] = useState('');

  const animeQuery = useQuery({
    queryKey: ['anime', animeId],
    queryFn: async () => {
      const response = await animeApi.get(animeId);
      return response.data;
    },
  });

  const myRatingQuery = useQuery({
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
      queryClient.invalidateQueries({ queryKey: ['anime', animeId] });
      queryClient.invalidateQueries({ queryKey: ['rating', animeId] });
    },
  });

  const postCommentMutation = useMutation({
    mutationFn: () => commentsApi.create(animeId, { content: commentText }),
    onSuccess: () => {
      setCommentText('');
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
        <div className="max-w-5xl mx-auto px-4 py-10 animate-pulse">
          <div className="h-10 w-56 rounded mb-4" style={{ background: 'var(--bg-card)' }} />
          <div className="h-4 w-96 rounded" style={{ background: 'var(--bg-card)' }} />
        </div>
      </main>
    );
  }

  const anime = animeQuery.data;
  if (!anime) {
    return (
      <main className="min-h-screen" style={{ background: 'var(--bg-base)' }}>
        <SiteHeader />
        <div className="max-w-5xl mx-auto px-4 py-10" style={{ color: 'var(--text-3)' }}>
          Anime not found.
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen" style={{ background: 'var(--bg-base)' }}>
      <SiteHeader />

      <section className="max-w-5xl mx-auto px-4 py-8">
        <Link href="/" className="text-sm" style={{ color: 'var(--text-3)' }}>
          Back to catalog
        </Link>

        <div className="mt-6 grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
          <div>
            <div className="flex flex-wrap gap-2 mb-4">
              {anime.genres.map((genre) => (
                <span
                  key={genre.id}
                  className="text-xs px-2 py-1 rounded-full"
                  style={{ background: 'var(--bg-hover)', color: 'var(--text-2)', border: '1px solid var(--border)' }}
                >
                  {genre.name}
                </span>
              ))}
            </div>

            <h1 className="text-4xl font-semibold" style={{ color: 'var(--text-1)' }}>
              {anime.title}
            </h1>
            <p className="text-sm mt-3 max-w-3xl" style={{ color: 'var(--text-2)' }}>
              {anime.description || 'No description yet.'}
            </p>

            <div className="grid sm:grid-cols-3 gap-4 mt-8">
              <StatCard label="Sub Avg" value={anime.avgSubRating ? anime.avgSubRating.toFixed(1) : '-'} />
              <StatCard label="Dub Avg" value={anime.avgDubRating ? anime.avgDubRating.toFixed(1) : '-'} />
              <StatCard label="Votes" value={String(anime.totalVotes)} />
            </div>

            <div className="card p-5 mt-8">
              <h2 className="text-lg font-semibold" style={{ color: 'var(--text-1)' }}>
                Rate This Series
              </h2>
              <p className="text-sm mt-1" style={{ color: 'var(--text-3)' }}>
                Use the buttons below to rate the sub and dub separately.
              </p>

              {user ? (
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

          <aside className="card p-5 h-fit">
            <h2 className="text-lg font-semibold" style={{ color: 'var(--text-1)' }}>
              Details
            </h2>
            <dl className="mt-4 space-y-3 text-sm">
              <div>
                <dt style={{ color: 'var(--text-3)' }}>Status</dt>
                <dd style={{ color: 'var(--text-1)' }}>{anime.status}</dd>
              </div>
              <div>
                <dt style={{ color: 'var(--text-3)' }}>Year</dt>
                <dd style={{ color: 'var(--text-1)' }}>{anime.releaseYear ?? '-'}</dd>
              </div>
              <div>
                <dt style={{ color: 'var(--text-3)' }}>Dub Available</dt>
                <dd style={{ color: 'var(--text-1)' }}>{anime.hasDub ? 'Yes' : 'No'}</dd>
              </div>
            </dl>
          </aside>
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-4 pb-12">
        <div className="card p-5">
          <h2 className="text-lg font-semibold" style={{ color: 'var(--text-1)' }}>
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
              <article key={comment.id} className="card p-4">
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

                {user?.id === comment.user?.id ? (
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
      <p className="text-xs uppercase tracking-[0.2em]" style={{ color: 'var(--text-3)' }}>
        {label}
      </p>
      <p className="text-3xl font-semibold mt-2" style={{ color: 'var(--text-1)' }}>
        {value}
      </p>
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
      <p className="text-sm font-medium" style={{ color: 'var(--text-1)' }}>
        {label}
      </p>
      <p className="text-xs mt-1" style={{ color: 'var(--text-3)' }}>
        Current rating: {currentValue ?? '-'}
      </p>
      <div className="flex gap-2 mt-4">
        {[1, 2, 3, 4, 5].map((value) => (
          <button
            key={value}
            className="w-10 h-10 rounded-lg text-sm font-medium"
            style={{
              background: currentValue === value ? 'var(--accent)' : 'var(--bg-hover)',
              color: currentValue === value ? '#fff' : 'var(--text-2)',
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
