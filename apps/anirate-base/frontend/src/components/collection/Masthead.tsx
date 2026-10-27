// Gallery signage across the top of every page. Presentational, so the no-JS
// catalog and the React pages share one masthead; the auth slot is filled per page.
// Links are plain anchors because they cross between the two routers, which also
// lets the browser run its cross-document view transition.
import type { ReactNode } from 'react';

export type MenuLink = { href: string; label: string };

export function Masthead({
  current,
  auth,
  menuLinks = [],
}: {
  current?: 'collection' | 'rankings';
  auth: ReactNode;
  /** Extra destinations for the phone menu, such as My ratings for a signed-in viewer. */
  menuLinks?: MenuLink[];
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
          {/* A native disclosure, so the phone menu opens on the zero-JS pages too. */}
          <details className="menu show-sm">
            <summary className="menu__toggle">Menu</summary>
            <ul className="menu__panel">
              <li>
                <a href="/">Collection</a>
              </li>
              <li>
                <a href="/catalog/search?sort=rating">Rankings</a>
              </li>
              <li>
                <a href="/request">Request a title</a>
              </li>
              {menuLinks.map((link) => (
                <li key={link.href}>
                  <a href={link.href}>{link.label}</a>
                </li>
              ))}
            </ul>
          </details>
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
