// Gallery signage across the top of every page. Presentational, so the no-JS
// catalog and the React pages share one masthead; the auth slot is filled per page.
// Links are plain anchors because they cross between the two routers, which also
// lets the browser run its cross-document view transition.
import type { ReactNode } from 'react';

export function Masthead({
  current,
  auth,
}: {
  current?: 'collection' | 'rankings';
  auth: ReactNode;
}) {
  return (
    <header className="masthead">
      <div className="wrap masthead__inner">
        <a className="brand" href="/" aria-label="AniRate, home">
          <span className="brand__mark" aria-hidden="true" />
          AniRate
        </a>

        <nav className="masthead__nav" aria-label="Primary">
          <a className="link hide-sm" href="/" aria-current={current === 'collection' ? 'page' : undefined}>
            Collection
          </a>
          <a
            className="link hide-sm"
            href="/catalog/search?sort=rating"
            aria-current={current === 'rankings' ? 'page' : undefined}
          >
            Rankings
          </a>
          {auth}
        </nav>
      </div>
    </header>
  );
}

export function SignedOutLinks() {
  return (
    <>
      <a className="link" href="/login">
        Sign in
      </a>
      <a className="btn btn--ink btn--sm" href="/register">
        Join
      </a>
    </>
  );
}
