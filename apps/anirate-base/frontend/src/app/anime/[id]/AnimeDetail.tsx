'use client';

// The work page: the cover hung on the wall, its label, the split between sub and
// dub, the visitor's own rating, and the notes left beneath it.
import Link from 'next/link';
import { useState, type CSSProperties } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Providers } from '@/app/providers';
import { Colophon } from '@/components/collection/Colophon';
import { Measure } from '@/components/collection/Measure';
import { Provenance } from '@/components/collection/Provenance';
import { Vacant } from '@/components/collection/Vacant';
import { WorkImage } from '@/components/collection/WorkImage';
import { SiteHeader } from '@/components/SiteHeader';
import { animeApi, commentsApi, dubApi, ratingsApi, type AnimeDetail, type CommentItem, type DubState } from '@/lib/api';
import { useAuthStore } from '@/lib/auth.store';
import { describeSplit, formatLabel, formatStatus, plural, workTransitionName, type Split } from '@/lib/scores';

type Distribution = { sub: number[]; dub: number[]; totalVotes: number };
type MyRating = { subRating?: number | null; dubRating?: number | null };

const REMOVED_CONTENT = new Set(['[deleted]', '[removed by moderator]']);
const dateFormat = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

type Props = { animeId: string; initialAnime: AnimeDetail | null };

export default function AnimeDetailView(props: Props) {
  return (
    <Providers>
      <AnimeDetailContent {...props} />
    </Providers>
  );
}

function AnimeDetailContent({ animeId, initialAnime }: Props) {
  const { user } = useAuthStore();

  // The server already rendered the record; the query keeps it fresh after ratings.
  const animeQuery = useQuery({
    queryKey: ['anime', animeId],
    queryFn: async () => (await animeApi.get(animeId)).data,
    initialData: initialAnime ?? undefined,
  });

  const distributionQuery = useQuery({
    queryKey: ['distribution', animeId],
    queryFn: async () => (await ratingsApi.distribution(animeId)).data as Distribution,
    enabled: Boolean(animeQuery.data),
  });

  if (animeQuery.isLoading) {
    return (
      <div>
        <SiteHeader />
        <DetailSkeleton animeId={animeId} />
      </div>
    );
  }

  const anime = animeQuery.data;
  if (!anime) {
    // Only a 404 means the work is missing; anything else is a failed request.
    const status = (animeQuery.error as { response?: { status?: number } } | null)?.response?.status;
    const missing = !animeQuery.error || status === 404 || status === 400;

    return (
      <div>
        <SiteHeader />
        {missing ? (
          <Vacant title="This work is not in the collection." body="It may have been removed, or the link may be incomplete." />
        ) : (
          <Vacant title="The work could not be loaded." body="The collection did not answer just now. Give it a moment and reload the page." />
        )}
      </div>
    );
  }

  const split = describeSplit(anime.avgSubRating, anime.avgDubRating);

  return (
    <div>
      <a className="skip-link" href="#main">
        Skip to the work
      </a>
      <SiteHeader />

      <main id="main" className="wrap">
        <nav className="crumbs" aria-label="Breadcrumb">
          <a className="link" href="/">
            Collection
          </a>
          <span className="crumbs__sep" aria-hidden="true">
            /
          </span>
          <span aria-current="page">{anime.title}</span>
        </nav>

        <article className="grid object" aria-labelledby="work-title">
          <div className="object__work">
            <div className="work" style={{ viewTransitionName: workTransitionName(anime.id) } as CSSProperties}>
              <WorkImage title={anime.title} src={anime.coverImageUrl} priority titled />
            </div>
            <p className="object__caption">
              <span className="num">{anime.releaseYear ?? 'Year unknown'}</span>
              {/* "No dub" is unknown for most imported titles, so it is never claimed. */}
              <span>{anime.hasDub ? 'Sub and dub' : 'Dub not yet listed'}</span>
            </p>
          </div>

          <div className="object__label">
            <header>
              <h1 id="work-title" className="title-xl">
                {anime.title}
              </h1>
              <p className="object__meta">
                {anime.format ? <span>{formatLabel(anime.format)}</span> : null}
                {anime.episodes ? <span className="num">{plural(anime.episodes, 'episode')}</span> : null}
                <span>{formatStatus(anime.status)}</span>
                {anime.genres.length ? <span>{anime.genres.map((genre) => genre.name).join(', ')}</span> : null}
              </p>
              <Provenance anime={anime} block />
              <AlsoKnownAs anime={anime} />
              {anime.description ? <Synopsis text={anime.description} /> : null}
              <Elsewhere anime={anime} />
            </header>

            <SplitSection anime={anime} split={split} distribution={distributionQuery.data ?? null} />
            <RateSection anime={anime} signedIn={Boolean(user)} />
            <NotesSection animeId={anime.id} userId={user?.id ?? null} />
          </div>
        </article>
      </main>

      {/* "Sign in to rate" already invites above, so the close is the colophon alone. */}
      <Colophon showInvitation={false} />
    </div>
  );
}

// The names a visitor might know the work by: English, romaji, Japanese.
function AlsoKnownAs({ anime }: { anime: AnimeDetail }) {
  const names = (anime.alternativeTitles ?? []).slice(0, 4);
  if (!names.length) {
    return null;
  }

  return (
    <p className="object__aka">
      <span className="signage">Also known as</span> <span lang="und">{names.join(' · ')}</span>
    </p>
  );
}

// Most imported titles carry no synopsis yet, so the label points to where one is.
function Elsewhere({ anime }: { anime: AnimeDetail }) {
  const links = [
    anime.externalIds?.anilist ? { label: 'AniList', href: `https://anilist.co/anime/${anime.externalIds.anilist}` } : null,
    anime.externalIds?.mal ? { label: 'MyAnimeList', href: `https://myanimelist.net/anime/${anime.externalIds.mal}` } : null,
  ].filter((link): link is { label: string; href: string } => link !== null);

  if (!links.length) {
    return null;
  }

  return (
    <p className="object__elsewhere">
      <span className="signage">{anime.description ? 'More on' : 'Synopsis on'}</span>{' '}
      {links.map((link, index) => (
        <span key={link.label}>
          {index > 0 ? ' · ' : null}
          <a className="link link--ruled" href={link.href} target="_blank" rel="noopener noreferrer">
            {link.label}
          </a>
        </span>
      ))}
    </p>
  );
}

// Long synopses are clamped so the split stays near the top of the page.
function Synopsis({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const long = text.length > 420;

  return (
    <div style={{ marginTop: '1.75rem' }}>
      <p id="synopsis" className={long && !open ? 'prose prose--clamped' : 'prose'}>
        {text}
      </p>
      {long ? (
        <button
          type="button"
          className="link link--ruled synopsis-toggle"
          aria-expanded={open}
          aria-controls="synopsis"
          onClick={() => setOpen((current) => !current)}
        >
          {open ? 'Show less' : 'Read the full synopsis'}
        </button>
      ) : null}
    </div>
  );
}

function SplitSection({ anime, split, distribution }: { anime: AnimeDetail; split: Split; distribution: Distribution | null }) {
  const subVotes = distribution ? distribution.sub.reduce((sum, count) => sum + count, 0) : null;
  const dubVotes = distribution ? distribution.dub.reduce((sum, count) => sum + count, 0) : null;

  return (
    <section className="section" aria-labelledby="split-title">
      <div className="section__head">
        <h2 id="split-title" className="title-m">
          The split
        </h2>
        <span className="muted num" style={{ fontSize: '0.875rem' }}>
          {plural(anime.totalVotes, 'rating')}
        </span>
      </div>

      <div className="split">
        <div style={{ display: 'grid', gap: '0.9rem', alignContent: 'start' }}>
          <Measure version="sub" value={split.sub} lead={split.lead === 'sub'} drawn emptyLabel="No ratings" />
          <p className="split__votes muted num">{subVotes === null ? ' ' : plural(subVotes, 'sub rating')}</p>
          {subVotes ? <Dist counts={distribution!.sub} lead={split.lead === 'sub'} label="Sub" /> : null}
        </div>
        <div style={{ display: 'grid', gap: '0.9rem', alignContent: 'start' }}>
          <Measure version="dub" value={split.dub} lead={split.lead === 'dub'} drawn delay={160} emptyLabel={anime.hasDub ? 'No ratings' : 'Not listed'} />
          <p className="split__votes muted num">
            {!anime.hasDub && !dubVotes
              ? anime.dubReports
                ? `Dub reported by ${plural(anime.dubReports, 'viewer')}`
                : 'No dub listed'
              : dubVotes === null
                ? ' '
                : plural(dubVotes, 'dub rating')}
          </p>
          {dubVotes ? <Dist counts={distribution!.dub} lead={split.lead === 'dub'} label="Dub" /> : null}
        </div>
      </div>

      <p className="verdict">
        <VerdictSentence split={split} hasDub={anime.hasDub} />
      </p>
    </section>
  );
}

function VerdictSentence({ split, hasDub }: { split: Split; hasDub: boolean }) {
  if (split.lead === 'sub' || split.lead === 'dub') {
    return (
      <>
        The <strong>{split.lead}</strong> leads by <strong className="num">{split.gap?.toFixed(1)}</strong>.
      </>
    );
  }

  if (split.lead === 'even') {
    return <>Sub and dub are level. Either is a safe choice.</>;
  }

  if (split.sub !== null) {
    return hasDub ? (
      <>Only the sub has ratings so far. Rate the dub to settle it.</>
    ) : (
      <>Only the sub has ratings so far. If you watched a dub, rate it to settle it.</>
    );
  }

  if (split.dub !== null) {
    return <>Only the dub has ratings so far. Rate the sub to settle it.</>;
  }

  return <>No ratings yet. Be the first to rate either version.</>;
}

// Five ruled steps per version, scaled to the most common score.
function Dist({ counts, lead, label }: { counts: number[]; lead: boolean; label: string }) {
  const max = Math.max(1, ...counts);

  return (
    <div className={`dist${lead ? ' dist--lead' : ''}`} role="group" aria-label={`${label} score distribution`}>
      {[5, 4, 3, 2, 1].map((score) => {
        const count = counts[score - 1] ?? 0;
        return (
          <div className="dist__row num" key={score}>
            <span>{score}</span>
            <span className="dist__bar" aria-hidden="true">
              <span style={{ '--v': count / max } as CSSProperties} />
            </span>
            <span style={{ textAlign: 'right' }}>
              {count}
              <span className="visually-hidden"> {count === 1 ? 'rating' : 'ratings'} of {score}</span>
            </span>
          </div>
        );
      })}
    </div>
  );
}

function RateSection({ anime, signedIn }: { anime: AnimeDetail; signedIn: boolean }) {
  return (
    <section className="section" aria-labelledby="rate-title">
      <div className="section__head">
        <h2 id="rate-title" className="title-m">
          Your rating
        </h2>
      </div>
      {signedIn ? (
        <RatePanel anime={anime} />
      ) : (
        <div style={{ display: 'grid', gap: '1rem', justifyItems: 'start' }}>
          <p className="muted">Sign in to rate the sub and the dub. Your two scores are counted separately.</p>
          <Link className="btn btn--ink btn--sm" href="/login">
            Sign in to rate
          </Link>
        </div>
      )}
    </section>
  );
}

function RatePanel({ anime }: { anime: AnimeDetail }) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<{ tone: 'ok' | 'error' | 'idle'; text: string }>({ tone: 'idle', text: '' });

  const myRatingQuery = useQuery({
    queryKey: ['rating', anime.id],
    queryFn: async () => (await ratingsApi.mine(anime.id)).data as MyRating,
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['anime', anime.id] });
    queryClient.invalidateQueries({ queryKey: ['rating', anime.id] });
    queryClient.invalidateQueries({ queryKey: ['distribution', anime.id] });
  };

  const rateMutation = useMutation({
    mutationFn: (payload: { subRating?: number; dubRating?: number }) => ratingsApi.upsert(anime.id, payload),
    onMutate: async (payload) => {
      // Show the choice at once; the request confirms it.
      setStatus({ tone: 'idle', text: 'Saving…' });
      queryClient.setQueryData<MyRating>(['rating', anime.id], (current) => ({ ...current, ...payload }));
    },
    onSuccess: (_response, payload) => {
      if (payload.dubRating !== undefined) {
        queryClient.invalidateQueries({ queryKey: ['dub', anime.id] });
      }
      const version = payload.subRating !== undefined ? 'Sub' : 'Dub';
      const value = payload.subRating ?? payload.dubRating;
      setStatus({ tone: 'ok', text: `Saved. ${version} rated ${value} of 5.` });
      refresh();
    },
    onError: () => {
      setStatus({ tone: 'error', text: 'That rating did not save. Try again.' });
      refresh();
    },
  });

  const clearMutation = useMutation({
    mutationFn: () => ratingsApi.remove(anime.id),
    onSuccess: () => {
      setStatus({ tone: 'ok', text: 'Your ratings for this work were cleared.' });
      refresh();
    },
    onError: () => setStatus({ tone: 'error', text: 'Could not clear your ratings. Try again.' }),
  });

  const mine = myRatingQuery.data;
  const hasRating = Boolean(mine?.subRating || mine?.dubRating);

  return (
    <div className="rate">
      <TileRow
        label="Sub"
        value={mine?.subRating ?? null}
        onRate={(value) => rateMutation.mutate({ subRating: value })}
      />
      {/* Most of the catalogue has no dub information yet, so the dub row is always
          offered: a viewer who watched one is the best source there is. */}
      <TileRow
        label="Dub"
        value={mine?.dubRating ?? null}
        onRate={(value) => rateMutation.mutate({ dubRating: value })}
      />
      {!anime.hasDub ? <DubReport animeId={anime.id} ratedDub={Boolean(mine?.dubRating)} /> : null}

      <div className="composer__foot">
        <p className={`rate__status rate__status--${status.tone}`} role="status" aria-live="polite">
          {status.text}
        </p>
        {hasRating ? (
          <button type="button" className="text-action" onClick={() => clearMutation.mutate()} disabled={clearMutation.isPending}>
            Clear my ratings
          </button>
        ) : null}
      </div>
    </div>
  );
}

// No open data source says which titles have an English dub, so viewers do: enough
// reports, or an admin, put the dub on record. Rating the dub counts as a report.
function DubReport({ animeId, ratedDub }: { animeId: string; ratedDub: boolean }) {
  const queryClient = useQueryClient();
  const stateQuery = useQuery({
    queryKey: ['dub', animeId],
    queryFn: async () => (await dubApi.mine(animeId)).data,
  });

  const settle = (state: DubState) => {
    queryClient.setQueryData(['dub', animeId], state);
    if (state.hasDub) {
      queryClient.invalidateQueries({ queryKey: ['anime', animeId] });
    }
  };

  const reportMutation = useMutation({
    mutationFn: async (report: boolean) => (report ? await dubApi.report(animeId) : await dubApi.withdraw(animeId)).data,
    onSuccess: settle,
  });

  // A dub rating files a report on the server, so refetch once the rating lands.
  const state = stateQuery.data;
  const reported = Boolean(state?.reportedByMe) || ratedDub;
  const pending = reportMutation.isPending;

  return (
    <div className="dub-report">
      <p className="dub-report__text">
        {state?.hasDub
          ? 'Thanks. The dub is now on record.'
          : reported
            ? `You reported an English dub. ${state ? `${plural(state.reports, 'report')} of ${state.threshold} needed to put it on record.` : ''}`
            : 'No English dub is on record for this title yet. Watched one? Say so, or rate it above.'}
      </p>
      {state && !state.hasDub ? (
        reported ? (
          state.reportedByMe && !ratedDub ? (
            <button type="button" className="text-action" disabled={pending} onClick={() => reportMutation.mutate(false)}>
              Take back my report
            </button>
          ) : null
        ) : (
          <button type="button" className="btn btn--line btn--sm" disabled={pending} onClick={() => reportMutation.mutate(true)}>
            It has an English dub
          </button>
        )
      ) : null}
      {reportMutation.isError ? (
        <p className="rate__status rate__status--error" role="status">
          That did not go through. Try again.
        </p>
      ) : null}
    </div>
  );
}

function TileRow({ label, value, onRate }: { label: string; value: number | null; onRate: (value: number) => void }) {
  return (
    <div className="rate__row" role="group" aria-labelledby={`rate-${label}`}>
      <span id={`rate-${label}`} className="signage">
        {label}
        <span className="visually-hidden">, out of 5</span>
      </span>
      <div className="rate__tiles">
        {[1, 2, 3, 4, 5].map((score) => (
          <button
            key={score}
            type="button"
            className="tile num"
            aria-pressed={value === score}
            aria-label={`${label} ${score} of 5`}
            onClick={() => onRate(score)}
          >
            {score}
          </button>
        ))}
      </div>
    </div>
  );
}

function NotesSection({ animeId, userId }: { animeId: string; userId: string | null }) {
  const queryClient = useQueryClient();
  const [text, setText] = useState('');
  const [confirming, setConfirming] = useState<string | null>(null);

  const commentsQuery = useQuery({
    queryKey: ['comments', animeId],
    queryFn: async () => (await commentsApi.list(animeId, { page: 1, limit: 20 })).data,
  });

  const postMutation = useMutation({
    mutationFn: () => commentsApi.create(animeId, { content: text }),
    onSuccess: () => {
      setText('');
      queryClient.invalidateQueries({ queryKey: ['comments', animeId] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (commentId: string) => commentsApi.delete(animeId, commentId),
    onSuccess: () => {
      setConfirming(null);
      queryClient.invalidateQueries({ queryKey: ['comments', animeId] });
    },
  });

  // A deleted note with no replies has nothing left to read, so it is not shown or counted.
  const allNotes = commentsQuery.data?.items ?? [];
  const notes = allNotes.filter((note) => !(REMOVED_CONTENT.has(note.content) && note.replies.length === 0));
  const total = Math.max(0, (commentsQuery.data?.pagination.total ?? 0) - (allNotes.length - notes.length));

  return (
    <section className="section" aria-labelledby="notes-title">
      <div className="section__head">
        <h2 id="notes-title" className="title-m">
          Notes
        </h2>
        <span className="muted num" style={{ fontSize: '0.875rem' }}>
          {plural(total, 'note')}
        </span>
      </div>

      {userId ? (
        <form
          className="composer"
          onSubmit={(event) => {
            event.preventDefault();
            if (text.trim()) {
              postMutation.mutate();
            }
          }}
        >
          <label htmlFor="note" className="field__label signage">
            Leave a note
          </label>
          <textarea
            id="note"
            className="input"
            rows={4}
            maxLength={2000}
            placeholder="Which version did you watch, and would you choose it again?"
            value={text}
            onChange={(event) => setText(event.target.value)}
          />
          <div className="composer__foot">
            <span className="muted num">{text.length} / 2000</span>
            <button type="submit" className="btn btn--ink btn--sm" disabled={!text.trim() || postMutation.isPending}>
              {postMutation.isPending ? 'Posting…' : 'Post note'}
            </button>
          </div>
          {postMutation.isError ? (
            <p role="alert" className="notice notice--error">
              Your note did not post. Check your connection and try again.
            </p>
          ) : null}
        </form>
      ) : (
        <p className="muted">
          <Link className="link link--ruled link--klein" href="/login">
            Sign in
          </Link>{' '}
          to leave a note for the next viewer.
        </p>
      )}

      {commentsQuery.isLoading ? (
        <div className="notes" aria-hidden="true">
          {[0, 1].map((row) => (
            <div className="note" key={row}>
              <span className="skeleton" style={{ height: '0.9rem', width: '9rem' }} />
              <span className="skeleton" style={{ height: '3rem', width: '100%' }} />
            </div>
          ))}
        </div>
      ) : notes.length === 0 ? (
        <p className="muted" style={{ paddingTop: '0.5rem' }}>
          No notes yet. Say which version you would recommend, and why.
        </p>
      ) : (
        <ol className="notes">
          {notes.map((note) => (
            <li key={note.id}>
              <Note
                note={note}
                own={Boolean(userId && note.user && note.user.id === userId)}
                confirming={confirming === note.id}
                onAskDelete={() => setConfirming(note.id)}
                onCancelDelete={() => setConfirming(null)}
                onDelete={() => deleteMutation.mutate(note.id)}
                deleting={deleteMutation.isPending && confirming === note.id}
              />
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function Note({
  note,
  own,
  confirming,
  onAskDelete,
  onCancelDelete,
  onDelete,
  deleting,
}: {
  note: CommentItem;
  own: boolean;
  confirming: boolean;
  onAskDelete: () => void;
  onCancelDelete: () => void;
  onDelete: () => void;
  deleting: boolean;
}) {
  const removed = REMOVED_CONTENT.has(note.content);

  return (
    <article className="note">
      <header className="note__head">
        <span className="note__author">{note.user?.username ?? 'Former member'}</span>
        <time className="muted num" dateTime={note.createdAt}>
          {dateFormat.format(new Date(note.createdAt))}
        </time>
        {note._count.likes !== 0 ? (
          <span className="muted num">{note._count.likes > 0 ? `+${note._count.likes}` : note._count.likes}</span>
        ) : null}
        {own && !removed ? (
          <span style={{ marginLeft: 'auto', display: 'inline-flex', gap: '1rem' }}>
            {confirming ? (
              <>
                <button type="button" className="text-action" style={{ color: 'var(--danger)' }} onClick={onDelete} disabled={deleting}>
                  {deleting ? 'Deleting…' : 'Delete note'}
                </button>
                <button type="button" className="text-action" onClick={onCancelDelete}>
                  Keep it
                </button>
              </>
            ) : (
              <button type="button" className="text-action" onClick={onAskDelete}>
                Delete
              </button>
            )}
          </span>
        ) : null}
      </header>
      <p className={`note__body${removed ? ' note__body--removed' : ''}`}>
        {removed ? (note.content === '[deleted]' ? 'Deleted by its author.' : 'Removed by a moderator.') : note.content}
      </p>

      {note.replies.length ? (
        <ol className="note__replies">
          {note.replies.map((reply) => (
            <li key={reply.id} className="note">
              <header className="note__head">
                <span className="note__author">{reply.user?.username ?? 'Former member'}</span>
                <time className="muted num" dateTime={reply.createdAt}>
                  {dateFormat.format(new Date(reply.createdAt))}
                </time>
              </header>
              <p className={`note__body${REMOVED_CONTENT.has(reply.content) ? ' note__body--removed' : ''}`}>
                {REMOVED_CONTENT.has(reply.content) ? 'This reply was removed.' : reply.content}
              </p>
            </li>
          ))}
        </ol>
      ) : null}
    </article>
  );
}

// Loading: the final layout in quiet toned blocks, so nothing jumps when data lands.
function DetailSkeleton({ animeId }: { animeId: string }) {
  return (
    <main className="wrap" aria-busy="true" aria-label="Loading the work">
      <div className="crumbs">
        <span className="skeleton" style={{ height: '0.9rem', width: '10rem' }} />
      </div>
      <div className="grid object">
        <div className="object__work">
          {/* Named like the real work so a transition still has somewhere to land. */}
          <div
            className="work skeleton"
            style={{ boxShadow: 'none', viewTransitionName: workTransitionName(animeId) } as CSSProperties}
          />
        </div>
        <div className="object__label">
          <div style={{ display: 'grid', gap: '1rem' }}>
            <span className="skeleton" style={{ height: '3.5rem', width: '80%' }} />
            <span className="skeleton" style={{ height: '1rem', width: '40%' }} />
            <span className="skeleton" style={{ height: '5.5rem', width: '100%' }} />
          </div>
          <div className="section">
            <div className="split">
              <span className="skeleton" style={{ height: '5rem' }} />
              <span className="skeleton" style={{ height: '5rem' }} />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
