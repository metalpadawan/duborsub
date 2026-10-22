'use client';

// The viewer's own checklist: every work they have rated, with the two scores they
// gave, most recently changed first.
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Providers } from '@/app/providers';
import { Colophon } from '@/components/collection/Colophon';
import { Measure } from '@/components/collection/Measure';
import { WorkImage } from '@/components/collection/WorkImage';
import { SiteHeader } from '@/components/SiteHeader';
import { myRatingsApi } from '@/lib/api';
import { useAuthStore } from '@/lib/auth.store';
import { formatCount, formatLabel, plural } from '@/lib/scores';

const dateFormat = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

export default function MyRatingsPage() {
  return (
    <Providers>
      <MyRatings />
    </Providers>
  );
}

function MyRatings() {
  const { user, isLoading } = useAuthStore();
  const [page, setPage] = useState(1);
  const ratingsQuery = useQuery({
    queryKey: ['my-ratings', page],
    queryFn: async () => (await myRatingsApi.list(page)).data,
    enabled: Boolean(user),
  });

  const data = ratingsQuery.data;

  return (
    <div>
      <SiteHeader />
      <main id="main" className="wrap collection my-ratings">
        <div className="collection__head">
          <h1 className="title-l">My ratings</h1>
          {data ? (
            <p className="collection__count muted num">{plural(data.pagination.total, 'work')} rated</p>
          ) : null}
        </div>

        {isLoading || (user && ratingsQuery.isLoading) ? (
          <p className="muted" aria-busy="true">
            Loading your ratings…
          </p>
        ) : !user ? (
          <div className="empty">
            <p className="title-m">Sign in to see your ratings.</p>
            <p className="muted">Every sub and dub score you give is kept here.</p>
            <a className="btn btn--ink btn--sm" href="/login">
              Sign in
            </a>
          </div>
        ) : ratingsQuery.isError ? (
          <div className="empty">
            <p className="title-m">Your ratings could not be loaded.</p>
            <p className="muted">The collection did not answer just now. Give it a moment and reload the page.</p>
          </div>
        ) : !data?.items.length ? (
          <div className="empty">
            <p className="title-m">You have not rated anything yet.</p>
            <p className="muted">Find a work you have watched and score its sub, its dub, or both.</p>
            <a className="btn btn--line btn--sm" href="/">
              Browse the collection
            </a>
          </div>
        ) : (
          <>
            <div className="checklist__cols signage" aria-hidden="true">
              <span />
              <span>Work</span>
              <span>Your sub</span>
              <span>Your dub</span>
              <span>Rated</span>
            </div>
            <ol className="checklist" start={(page - 1) * data.pagination.limit + 1}>
              {data.items.map((item) => (
                <li key={item.anime.id}>
                  <a className="entry" href={`/anime/${item.anime.id}`}>
                    <span className="thumb">
                      <WorkImage title={item.anime.title} src={item.anime.coverImageUrl} decorative />
                    </span>
                    <span className="entry__main">
                      <span className="entry__title" style={{ display: 'block' }}>
                        {item.anime.title}
                      </span>
                      <span className="entry__meta" style={{ display: 'block' }}>
                        {[item.anime.releaseYear, formatLabel(item.anime.format)].filter(Boolean).join(' · ')}
                      </span>
                    </span>
                    <Measure version="sub" value={item.subRating} />
                    <Measure version="dub" value={item.dubRating} />
                    <span className="entry__verdict muted num">{dateFormat.format(new Date(item.updatedAt))}</span>
                  </a>
                </li>
              ))}
            </ol>

            {data.pagination.pages > 1 ? (
              <nav className="pager" aria-label="Rating pages">
                <p className="pager__state muted num">
                  Page {formatCount(page)} of {formatCount(data.pagination.pages)}
                </p>
                <div className="pager__controls">
                  <button type="button" className="btn btn--line btn--sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                    Previous
                  </button>
                  <button
                    type="button"
                    className="btn btn--line btn--sm"
                    disabled={page >= data.pagination.pages}
                    onClick={() => setPage(page + 1)}
                  >
                    Next
                  </button>
                </div>
              </nav>
            ) : null}
          </>
        )}
      </main>
      <Colophon showInvitation={false} />
    </div>
  );
}
