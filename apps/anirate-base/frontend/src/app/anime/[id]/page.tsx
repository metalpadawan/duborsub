// src/app/anime/[id]/page.tsx — Anime Detail Page
'use client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { animeApi, ratingsApi, commentsApi } from '@/lib/api';
import { useAuthStore } from '@/lib/auth.store';

export default function AnimeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuthStore();
  const qc = useQueryClient();

  const { data: anime, isLoading } = useQuery({
    queryKey: ['anime', id],
    queryFn: () => animeApi.get(id).then((r) => r.data),
  });

  const { data: myRating } = useQuery({
    queryKey: ['rating', id],
    queryFn: () => ratingsApi.mine(id).then((r) => r.data),
    enabled: !!user,
  });

  const ratingMutation = useMutation({
    mutationFn: (data: { subRating?: number; dubRating?: number }) =>
      ratingsApi.upsert(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['anime', id] });
      qc.invalidateQueries({ queryKey: ['rating', id] });
    },
  });

  if (isLoading) return <DetailSkeleton />;
  if (!anime) return <div className="text-center py-20" style={{ color: 'var(--text-3)' }}>Anime not found</div>;

  return (
    <main className="min-h-screen" style={{ background: 'var(--bg-base)' }}>
      {/* Back nav */}
      <div className="max-w-6xl mx-auto px-4 pt-6">
        <Link href="/" className="text-sm transition-colors" style={{ color: 'var(--text-3)' }}>
          ← Back to catalog
        </Link>
      </div>

      {/* Hero */}
      <div className="max-w-6xl mx-auto px-4 py-8 flex flex-col md:flex-row gap-8">
        {/* Cover */}
        <div className="flex-shrink-0">
          <div className="relative w-48 h-72 rounded-xl overflow-hidden"
               style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            {anime.coverImageUrl ? (
              <Image src={anime.coverImageUrl} alt={anime.title} fill className="object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-5xl">⛩</div>
            )}
          </div>
        </div>

        {/* Info */}
        <div className="flex-1">
          <div className="flex flex-wrap gap-2 mb-3">
            {anime.genres?.map((g: any) => (
              <span key={g.id} className="text-xs px-2 py-1 rounded-full"
                    style={{ background: 'var(--bg-hover)', color: 'var(--text-2)', border: '1px solid var(--border)' }}>
                {g.name}
              </span>
            ))}
            <span className="text-xs px-2 py-1 rounded-full capitalize"
                  style={{ background: 'var(--bg-hover)', color: 'var(--text-2)', border: '1px solid var(--border)' }}>
              {anime.status}
            </span>
            {anime.hasDub && (
              <span className="text-xs px-2 py-1 rounded-full font-medium"
                    style={{ background: 'rgba(224,64,176,0.15)', color: 'var(--accent)', border: '1px solid rgba(224,64,176,0.3)' }}>
                DUB available
              </span>
            )}
          </div>

          <h1 className="text-3xl font-bold mb-1" style={{ color: 'var(--text-1)' }}>{anime.title}</h1>
          <p className="text-sm mb-4" style={{ color: 'var(--text-3)' }}>{anime.releaseYear}</p>
          <p className="text-sm leading-relaxed mb-6" style={{ color: 'var(--text-2)' }}>
            {anime.description ?? 'No description available.'}
          </p>

          {/* Sub vs Dub rating comparison */}
          <RatingComparison
            anime={anime}
            myRating={myRating}
            onRate={(type, value) => ratingMutation.mutate({ [`${type}Rating`]: value })}
            canRate={!!user}
          />
        </div>
      </div>

      {/* Comments */}
      <div className="max-w-6xl mx-auto px-4 pb-16">
        <h2 className="text-lg font-semibold mb-6" style={{ color: 'var(--text-1)' }}>
          Discussion
        </h2>
        <CommentsSection animeId={id} user={user} />
      </div>
    </main>
  );
}

// ── Rating Comparison Component ───────────────────────────────
function RatingComparison({ anime, myRating, onRate, canRate }: any) {
  return (
    <div className="card p-5 max-w-lg">
      <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-2)' }}>
        COMMUNITY RATINGS — {anime.totalVotes} votes
      </h3>
      <div className="grid grid-cols-2 gap-6">
        <RatingBlock
          label="Sub"
          avg={anime.avgSubRating}
          myScore={myRating?.subRating}
          canRate={canRate}
          onRate={(v) => onRate('sub', v)}
        />
        {anime.hasDub && (
          <RatingBlock
            label="Dub"
            avg={anime.avgDubRating}
            myScore={myRating?.dubRating}
            canRate={canRate}
            onRate={(v) => onRate('dub', v)}
          />
        )}
      </div>
      {!canRate && (
        <p className="text-xs mt-4" style={{ color: 'var(--text-3)' }}>
          <Link href="/login" style={{ color: 'var(--accent)' }}>Sign in</Link> to rate this anime
        </p>
      )}
    </div>
  );
}

function RatingBlock({ label, avg, myScore, canRate, onRate }: any) {
  const [hover, setHover] = useState(0);
  const display = hover || myScore || 0;

  return (
    <div>
      <div className="text-xs font-medium mb-2" style={{ color: 'var(--text-3)' }}>{label.toUpperCase()}</div>
      <div className="text-3xl font-bold mb-1" style={{ color: avg ? '#f59e0b' : 'var(--text-3)' }}>
        {avg ? Number(avg).toFixed(1) : '—'}
      </div>
      {canRate && (
        <div className="flex gap-1 mt-2">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              className="text-xl transition-transform hover:scale-125"
              style={{ color: star <= display ? '#f59e0b' : 'var(--text-3)' }}
              onMouseEnter={() => setHover(star)}
              onMouseLeave={() => setHover(0)}
              onClick={() => onRate(star)}
              title={`Rate ${star}/5`}
            >
              ★
            </button>
          ))}
        </div>
      )}
      {myScore && (
        <p className="text-xs mt-1" style={{ color: 'var(--text-3)' }}>Your rating: {myScore}/5</p>
      )}
    </div>
  );
}

// ── Comments Section ──────────────────────────────────────────
function CommentsSection({ animeId, user }: { animeId: string; user: any }) {
  const qc = useQueryClient();
  const [newComment, setNewComment] = useState('');
  const [replyTo, setReplyTo] = useState<string | null>(null);

  const { data, fetchNextPage, hasNextPage } = useQuery({
    queryKey: ['comments', animeId],
    queryFn: () => commentsApi.list(animeId, { page: 1, limit: 20 }).then((r) => r.data),
  });

  const postMutation = useMutation({
    mutationFn: (content: string) =>
      commentsApi.create(animeId, { content, parentId: replyTo ?? undefined }),
    onSuccess: () => {
      setNewComment('');
      setReplyTo(null);
      qc.invalidateQueries({ queryKey: ['comments', animeId] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (commentId: string) => commentsApi.delete(animeId, commentId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['comments', animeId] }),
  });

  return (
    <div>
      {/* New comment form */}
      {user ? (
        <div className="card p-4 mb-6">
          <textarea
            className="input resize-none mb-3"
            rows={3}
            placeholder={replyTo ? 'Write a reply...' : 'Share your thoughts...'}
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            maxLength={2000}
          />
          <div className="flex gap-2 justify-end">
            {replyTo && (
              <button className="btn-ghost text-sm" onClick={() => setReplyTo(null)}>
                Cancel
              </button>
            )}
            <button
              className="btn-primary text-sm"
              disabled={!newComment.trim() || postMutation.isPending}
              onClick={() => postMutation.mutate(newComment.trim())}
            >
              {postMutation.isPending ? 'Posting...' : 'Post'}
            </button>
          </div>
        </div>
      ) : (
        <div className="card p-4 mb-6 text-sm text-center" style={{ color: 'var(--text-3)' }}>
          <Link href="/login" style={{ color: 'var(--accent)' }}>Sign in</Link> to join the discussion
        </div>
      )}

      {/* Comment list */}
      <div className="flex flex-col gap-4">
        {data?.items?.map((comment: any) => (
          <CommentItem
            key={comment.id}
            comment={comment}
            user={user}
            animeId={animeId}
            onReply={() => setReplyTo(comment.id)}
            onDelete={() => deleteMutation.mutate(comment.id)}
          />
        ))}
      </div>
    </div>
  );
}

function CommentItem({ comment, user, animeId, onReply, onDelete }: any) {
  const qc = useQueryClient();
  const isOwner = user?.id === comment.user?.id;

  const likeMutation = useMutation({
    mutationFn: (value: 1 | -1) => commentsApi.like(animeId, comment.id, value),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['comments', animeId] }),
  });

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium" style={{ color: 'var(--text-1)' }}>
          {comment.user?.username}
        </span>
        <span className="text-xs" style={{ color: 'var(--text-3)' }}>
          {new Date(comment.createdAt).toLocaleDateString()}
        </span>
      </div>
      <p className="text-sm mb-3" style={{ color: 'var(--text-2)' }}>{comment.content}</p>
      <div className="flex items-center gap-3">
        {user && (
          <>
            <button
              className="text-xs transition-colors"
              style={{ color: 'var(--text-3)' }}
              onClick={() => likeMutation.mutate(1)}
            >
              ↑ {comment._count?.likes ?? 0}
            </button>
            <button
              className="text-xs transition-colors"
              style={{ color: 'var(--text-3)' }}
              onClick={() => likeMutation.mutate(-1)}
            >
              ↓
            </button>
            <button
              className="text-xs transition-colors"
              style={{ color: 'var(--text-3)' }}
              onClick={onReply}
            >
              Reply
            </button>
          </>
        )}
        {isOwner && (
          <button
            className="text-xs ml-auto transition-colors"
            style={{ color: '#ef4444' }}
            onClick={onDelete}
          >
            Delete
          </button>
        )}
      </div>

      {/* Replies */}
      {comment.replies?.length > 0 && (
        <div className="mt-3 pl-4 border-l flex flex-col gap-3" style={{ borderColor: 'var(--border)' }}>
          {comment.replies.map((reply: any) => (
            <div key={reply.id}>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-medium" style={{ color: 'var(--text-1)' }}>
                  {reply.user?.username}
                </span>
                <span className="text-xs" style={{ color: 'var(--text-3)' }}>
                  {new Date(reply.createdAt).toLocaleDateString()}
                </span>
              </div>
              <p className="text-sm" style={{ color: 'var(--text-2)' }}>{reply.content}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Skeleton ──────────────────────────────────────────────────
function DetailSkeleton() {
  return (
    <main className="min-h-screen" style={{ background: 'var(--bg-base)' }}>
      <div className="max-w-6xl mx-auto px-4 py-8 flex gap-8 animate-pulse">
        <div className="w-48 h-72 rounded-xl" style={{ background: 'var(--bg-card)' }} />
        <div className="flex-1 space-y-4">
          <div className="h-8 w-64 rounded" style={{ background: 'var(--bg-card)' }} />
          <div className="h-4 w-96 rounded" style={{ background: 'var(--bg-card)' }} />
          <div className="h-4 w-80 rounded" style={{ background: 'var(--bg-card)' }} />
        </div>
      </div>
    </main>
  );
}
