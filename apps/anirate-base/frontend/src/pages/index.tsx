import type { GetStaticProps } from 'next';
import Head from 'next/head';
import { PublicHeader } from '@/components/PublicHeader';
import type { Anime } from '@/lib/api';
import { PAGE_SIZE, sortLabels, type HomeProps, type SortKey } from '@/lib/catalog-view';

export const config: any = {
  unstable_runtimeJS: false,
};

export const getStaticProps: GetStaticProps<HomeProps> = async () => {
  const { loadCatalogPageProps } = await import('@/lib/server/catalog-page-props');
  const props = await loadCatalogPageProps({});

  return {
    props,
    revalidate: 60,
  };
};

export default function HomePage({
  search,
  sort,
  genre,
  genres,
  items,
  page,
  totalItems,
  totalPages,
}: HomeProps) {
  const startItem = totalItems === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const endItem = Math.min(page * PAGE_SIZE, totalItems);
  const visibleVotes = items.reduce((sum, anime) => sum + anime.totalVotes, 0);
  const dubReadyCount = items.filter((anime) => anime.hasDub).length;
  const topVisibleScore = items.reduce((score, anime) => Math.max(score, Number(anime.avgSubRating ?? 0), Number(anime.avgDubRating ?? 0)), 0);

  return (
    <>
      <Head>
        <title>AniRate - Sub vs Dub</title>
        <meta name="description" content="Community ratings for anime sub and dub versions" />
        <link
          rel="icon"
          href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='7' fill='%2322c55e'/%3E%3Ctext x='16' y='21' text-anchor='middle' font-family='Arial' font-size='14' font-weight='800' fill='%230b1220'%3EA%3C/text%3E%3C/svg%3E"
        />
        <style dangerouslySetInnerHTML={{ __html: criticalCss }} />
      </Head>

      <main className="home-shell">
        <PublicHeader />

        <section className="hero-section">
          <div className="site-wrap hero-grid">
            <div className="hero-copy">
              <p className="kicker">Anime companion database</p>
              <h1 className="hero-title">Find the version worth watching.</h1>
              <p className="hero-text">
                Search, sort, and compare community sub and dub scores with the same stat-first density you expect from a game companion.
              </p>
              <div className="hero-actions" aria-label="Primary catalog actions">
                <a className="btn-primary" href="/catalog/search?sort=rating">
                  View top rated
                </a>
                <a className="btn-ghost" href="/catalog/search?sort=votes">
                  Most discussed
                </a>
              </div>
            </div>

            <aside className="command-panel" aria-label="Catalog snapshot">
              <div className="panel-head">
                <span>Live catalog scan</span>
                <strong>{page.toString().padStart(2, '0')}</strong>
              </div>
              <div className="metric-grid">
                <StatTile label="Anime indexed" value={String(totalItems)} />
                <StatTile label="Visible votes" value={String(visibleVotes)} />
                <StatTile label="Dub ready" value={`${dubReadyCount}/${items.length}`} />
                <StatTile label="Top score" value={topVisibleScore ? topVisibleScore.toFixed(1) : '-'} />
              </div>
              <div className="scan-list">
                {items.slice(0, 3).map((anime, index) => (
                  <a key={anime.id} href={`/anime/${anime.id}`} className="scan-row">
                    <span>{String(index + startItem).padStart(2, '0')}</span>
                    <b>{anime.title}</b>
                    <em>{anime.hasDub ? 'SUB/DUB' : 'SUB'}</em>
                  </a>
                ))}
              </div>
            </aside>
          </div>
        </section>

        <section className="mode-strip" aria-label="Catalog modes">
          <div className="site-wrap mode-inner">
            <span className="mode-pill mode-pill-active">Database</span>
            <span className="mode-pill">Score compare</span>
            <span className="mode-pill">Community notes</span>
            <span className="mode-pill">Watchlist ready</span>
          </div>
        </section>

        <section className="filter-band">
          <div className="site-wrap filter-inner">
            <div className="filter-copy">
              <span className="data-label">Filters</span>
              <strong>Build your watch query</strong>
            </div>
            <form action="/catalog/search" className="filter-form">
              <input name="q" className="input search-input" placeholder="Search anime..." defaultValue={search} />
              <select name="sort" className="input sort-input" defaultValue={sort}>
                {Object.entries(sortLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              {genre ? <input type="hidden" name="genre" value={genre} /> : null}
              <button className="btn-primary" type="submit">
                Apply
              </button>
            </form>

            <div className="genre-list">
              {genres.map((option) => {
                const value = option === 'All' ? '' : option;
                const active = genre === value;

                return (
                  <a
                    key={option}
                    href={getGenreHref({ search, sort, genre: value })}
                    className={active ? 'genre-pill genre-pill-active' : 'genre-pill'}
                  >
                    {option}
                  </a>
                );
              })}
            </div>
          </div>
        </section>

        <section className="site-wrap catalog-section">
          <div className="section-head">
            <div>
              <span className="data-label">Result grid</span>
              <h2>Anime index</h2>
            </div>
            <p>
              Showing {startItem}-{endItem} of {totalItems}
            </p>
          </div>
          <div className="catalog-list">
            {items.map((anime) => (
              <AnimeCard key={anime.id} anime={anime} />
            ))}
          </div>

          {items.length === 0 ? <div className="empty-state">No anime matched that filter.</div> : null}

          {totalPages > 1 ? (
            <nav className="pager" aria-label="Catalog pages">
              <p className="pager-count">
                Showing {startItem}-{endItem} of {totalItems}
              </p>

              <div className="pager-controls">
                {page > 1 ? (
                  <a className="btn-ghost" href={getPageHref({ search, sort, genre, page: page - 1 })}>
                    Previous
                  </a>
                ) : (
                  <span className="btn-ghost" aria-disabled="true">
                    Previous
                  </span>
                )}

                <span className="pager-state">
                  {page} / {totalPages}
                </span>

                {page < totalPages ? (
                  <a className="btn-ghost" href={getPageHref({ search, sort, genre, page: page + 1 })}>
                    Next
                  </a>
                ) : (
                  <span className="btn-ghost" aria-disabled="true">
                    Next
                  </span>
                )}
              </div>
            </nav>
          ) : null}
        </section>
      </main>
    </>
  );
}

function getGenreHref({ search, sort, genre }: { search: string; sort: SortKey; genre: string }) {
  return getSearchHref({ search, sort, genre });
}

function getPageHref({ search, sort, genre, page }: { search: string; sort: SortKey; genre: string; page: number }) {
  if (search || genre || sort !== 'title') {
    return getSearchHref({ search, sort, genre, page });
  }

  return page <= 1 ? '/' : `/catalog/${page}`;
}

function getSearchHref({ search, sort, genre, page }: { search: string; sort: SortKey; genre: string; page?: number }) {
  const params = new URLSearchParams();

  if (search) {
    params.set('q', search);
  }

  if (sort !== 'title') {
    params.set('sort', sort);
  }

  if (genre) {
    params.set('genre', genre);
  }

  if (page && page > 1) {
    params.set('page', String(page));
  }

  const query = params.toString();
  return query ? `/catalog/search?${query}` : '/catalog/search';
}

function AnimeCard({ anime }: { anime: Anime }) {
  const initials = anime.title
    .split(' ')
    .map((word) => word[0])
    .join('')
    .slice(0, 2);

  const subScore = anime.avgSubRating ? Number(anime.avgSubRating).toFixed(1) : '-';
  const dubScore = anime.avgDubRating ? Number(anime.avgDubRating).toFixed(1) : '-';
  const scoreDelta =
    anime.avgSubRating && anime.avgDubRating ? (Number(anime.avgDubRating) - Number(anime.avgSubRating)).toFixed(1) : null;

  return (
    <a href={`/anime/${anime.id}`} className="anime-row">
      <span className="anime-mark">{initials}</span>
      <span className="anime-row-main">
        <span className="anime-title">{anime.title}</span>
        <span className="anime-meta">
          {anime.releaseYear ?? '-'}
          <span>{anime.totalVotes} votes</span>
          <span>{anime.status}</span>
        </span>
      </span>
      <span className="score-stack" aria-label={`Sub score ${subScore}, dub score ${dubScore}`}>
        <span>
          <b>{subScore}</b>
          <em>SUB</em>
        </span>
        <span>
          <b>{dubScore}</b>
          <em>DUB</em>
        </span>
      </span>
      <span className={scoreDelta ? 'delta-chip' : 'delta-chip delta-muted'}>{scoreDelta ? `${Number(scoreDelta) > 0 ? '+' : ''}${scoreDelta}` : 'NEW'}</span>
      {anime.hasDub ? <span className="dub-chip">DUB</span> : <span className="sub-chip">SUB</span>}
    </a>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat-tile">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

const criticalCss = `
:root {
  --bg-base: oklch(12% 0.028 255);
  --bg-surface: oklch(16% 0.032 255);
  --bg-card: oklch(19% 0.035 255);
  --bg-hover: oklch(24% 0.04 255);
  --accent: oklch(73% 0.17 156);
  --accent-alt: oklch(70% 0.18 248);
  --warn: oklch(76% 0.15 78);
  --text-1: oklch(96% 0.012 245);
  --text-2: oklch(74% 0.026 250);
  --text-3: oklch(56% 0.026 250);
  --border: color-mix(in oklch, var(--text-1) 10%, transparent);
}
* { box-sizing: border-box; }
html { scroll-behavior: smooth; }
body {
  margin: 0;
  background:
    radial-gradient(circle at 12% 0%, color-mix(in oklch, var(--accent-alt) 20%, transparent), transparent 24rem),
    radial-gradient(circle at 88% 6%, color-mix(in oklch, var(--accent) 14%, transparent), transparent 22rem),
    var(--bg-base);
  color: var(--text-1);
  font-family: "Segoe UI", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
  -webkit-font-smoothing: antialiased;
  font-variant-numeric: tabular-nums;
}
a { color: inherit; text-decoration: none; }
button, input, select { font: inherit; }
.home-shell { min-height: 100vh; }
.site-wrap { width: min(100% - 2rem, 82rem); margin: 0 auto; }
.data-label, .kicker {
  color: var(--accent);
  font-size: .72rem;
  line-height: 1rem;
  font-weight: 800;
  letter-spacing: .16em;
  text-transform: uppercase;
}
.public-header {
  position: sticky;
  top: 0;
  z-index: 20;
  border-bottom: 1px solid var(--border);
  background: color-mix(in oklch, var(--bg-surface) 88%, transparent);
  backdrop-filter: blur(16px);
}
.header-inner { display: flex; align-items: center; justify-content: space-between; gap: 1rem; padding-top: .875rem; padding-bottom: .875rem; }
.brand-link { display: flex; align-items: center; gap: .75rem; min-width: 0; }
.brand-mark {
  display: grid;
  place-items: center;
  width: 2.5rem;
  height: 2.5rem;
  border-radius: .625rem;
  background: linear-gradient(135deg, var(--accent), var(--accent-alt));
  color: var(--bg-base);
  font-weight: 950;
}
.brand-stack { display: grid; gap: .125rem; min-width: 0; }
.brand-name { color: var(--text-1); font-size: 1.25rem; line-height: 1.15; font-weight: 900; }
.brand-subtitle { color: var(--text-3); font-size: .68rem; line-height: 1rem; letter-spacing: .16em; text-transform: uppercase; white-space: nowrap; }
.header-nav { display: flex; align-items: center; gap: .625rem; }
.nav-link { color: var(--text-2); font-size: .875rem; font-weight: 700; }
.btn-primary, .btn-ghost {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 2.75rem;
  border-radius: .625rem;
  padding: .625rem 1rem;
  font-size: .875rem;
  line-height: 1.25rem;
  font-weight: 800;
  border: 1px solid transparent;
  white-space: nowrap;
}
.btn-primary { background: var(--accent); color: var(--bg-base); }
.btn-ghost { color: var(--text-2); border-color: var(--border); background: color-mix(in oklch, var(--bg-card) 72%, transparent); }
.btn-ghost[aria-disabled="true"] { opacity: .5; pointer-events: none; }
.btn-primary:focus-visible, .btn-ghost:focus-visible, .input:focus-visible, a:focus-visible {
  outline: 3px solid color-mix(in oklch, var(--accent-alt) 65%, transparent);
  outline-offset: 2px;
}
.hero-section { padding: clamp(2rem, 5vw, 4.75rem) 0 1.5rem; }
.hero-grid { display: grid; grid-template-columns: minmax(0, 1.05fr) minmax(22rem, .95fr); gap: clamp(1rem, 4vw, 2rem); align-items: center; }
.hero-copy { max-width: 43rem; }
.hero-title { margin: .8rem 0 0; color: var(--text-1); font-size: clamp(2.6rem, 7vw, 5.9rem); line-height: .9; font-weight: 950; letter-spacing: -.045em; text-wrap: balance; }
.hero-text { margin: 1.1rem 0 0; max-width: 38rem; color: var(--text-2); font-size: clamp(1rem, 1.5vw, 1.25rem); line-height: 1.55; }
.hero-actions { display: flex; flex-wrap: wrap; gap: .75rem; margin-top: 1.5rem; }
.command-panel {
  border: 1px solid var(--border);
  border-radius: .875rem;
  background: linear-gradient(180deg, color-mix(in oklch, var(--bg-card) 94%, transparent), color-mix(in oklch, var(--bg-surface) 94%, transparent));
  box-shadow: 0 24px 90px rgb(0 0 0 / .28);
  padding: 1rem;
}
.panel-head { display: flex; align-items: center; justify-content: space-between; gap: 1rem; color: var(--text-3); font-size: .75rem; font-weight: 800; letter-spacing: .14em; text-transform: uppercase; }
.panel-head strong { color: var(--accent); font-family: ui-monospace, "Cascadia Mono", Menlo, monospace; }
.metric-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: .625rem; margin-top: 1rem; }
.stat-tile { border: 1px solid var(--border); border-radius: .625rem; background: var(--bg-surface); padding: .875rem; }
.stat-tile span { display: block; color: var(--text-3); font-size: .7rem; font-weight: 800; letter-spacing: .11em; text-transform: uppercase; }
.stat-tile strong { display: block; margin-top: .35rem; color: var(--text-1); font-size: 1.65rem; line-height: 1; font-weight: 950; }
.scan-list { display: grid; gap: .5rem; margin-top: 1rem; }
.scan-row {
  display: grid;
  grid-template-columns: 2rem minmax(0, 1fr) auto;
  gap: .75rem;
  align-items: center;
  min-height: 3rem;
  border: 1px solid var(--border);
  border-radius: .625rem;
  background: color-mix(in oklch, var(--bg-hover) 58%, transparent);
  padding: .5rem .625rem;
}
.scan-row span, .scan-row em { color: var(--text-3); font-family: ui-monospace, "Cascadia Mono", Menlo, monospace; font-size: .72rem; font-style: normal; }
.scan-row b { overflow: hidden; color: var(--text-1); font-size: .875rem; text-overflow: ellipsis; white-space: nowrap; }
.mode-strip { border-block: 1px solid var(--border); background: color-mix(in oklch, var(--bg-surface) 78%, transparent); }
.mode-inner { display: flex; gap: .5rem; overflow-x: auto; padding-block: .75rem; }
.mode-pill {
  display: inline-flex;
  align-items: center;
  min-height: 2rem;
  border: 1px solid var(--border);
  border-radius: 999px;
  color: var(--text-2);
  background: var(--bg-card);
  padding: .35rem .75rem;
  font-size: .78rem;
  font-weight: 800;
  white-space: nowrap;
}
.mode-pill-active { border-color: color-mix(in oklch, var(--accent) 58%, var(--border)); color: var(--accent); background: color-mix(in oklch, var(--accent) 12%, var(--bg-card)); }
.filter-band { border-bottom: 1px solid var(--border); background: color-mix(in oklch, var(--bg-surface) 92%, transparent); }
.filter-inner { display: grid; grid-template-columns: auto minmax(0, 1fr); align-items: start; gap: 1rem; padding-top: 1rem; padding-bottom: 1rem; }
.filter-copy { min-width: 13rem; }
.filter-copy strong { display: block; margin-top: .25rem; color: var(--text-1); }
.filter-form { display: grid; grid-template-columns: minmax(14rem, 1fr) 10rem auto; align-items: center; gap: .75rem; }
.input {
  width: 100%;
  min-height: 2.75rem;
  border-radius: .625rem;
  border: 1px solid var(--border);
  background: var(--bg-base);
  color: var(--text-1);
  padding: .625rem .75rem;
  font-size: .875rem;
  line-height: 1.25rem;
  outline: none;
}
.input::placeholder { color: var(--text-3); }
.genre-list { grid-column: 2; display: flex; flex-wrap: wrap; gap: .5rem; }
.genre-pill {
  display: inline-flex;
  align-items: center;
  min-height: 2rem;
  border-radius: 999px;
  border: 1px solid var(--border);
  background: var(--bg-card);
  color: var(--text-2);
  padding: .3rem .75rem;
  font-size: .75rem;
  line-height: 1rem;
  font-weight: 800;
}
.genre-pill-active { border-color: var(--accent); background: color-mix(in oklch, var(--accent) 18%, var(--bg-card)); color: var(--accent); }
.catalog-section { padding-top: 2rem; padding-bottom: 2rem; }
.section-head { display: flex; align-items: end; justify-content: space-between; gap: 1rem; margin-bottom: 1rem; }
.section-head h2 { margin: .25rem 0 0; color: var(--text-1); font-size: 1.4rem; line-height: 1.1; }
.section-head p { margin: 0; color: var(--text-3); font-size: .875rem; }
.catalog-list { display: grid; gap: .5rem; }
.anime-row {
  display: grid;
  grid-template-columns: 2.75rem minmax(0, 1fr) auto auto auto;
  align-items: center;
  gap: .75rem;
  min-height: 4.25rem;
  border: 1px solid var(--border);
  border-radius: .625rem;
  background: color-mix(in oklch, var(--bg-card) 92%, transparent);
  padding: .625rem .75rem .625rem .625rem;
  transition: border-color .18s ease, transform .18s ease, background .18s ease;
}
.anime-row:hover { border-color: color-mix(in oklch, var(--accent) 62%, var(--border)); background: var(--bg-hover); transform: translateY(-1px); }
.anime-mark {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2.75rem;
  height: 2.75rem;
  border-radius: .5rem;
  background: linear-gradient(135deg, var(--accent-alt), var(--accent));
  color: var(--bg-base);
  font-size: .82rem;
  line-height: 1.25rem;
  font-weight: 950;
}
.anime-row-main { display: block; min-width: 0; }
.anime-title {
  display: block;
  overflow: hidden;
  color: var(--text-1);
  font-size: .95rem;
  line-height: 1.25rem;
  font-weight: 850;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.anime-meta {
  display: flex;
  flex-wrap: wrap;
  gap: .5rem;
  margin-top: .25rem;
  color: var(--text-3);
  font-size: .75rem;
  line-height: 1rem;
}
.score-stack { display: grid; grid-template-columns: repeat(2, 3.65rem); gap: .375rem; }
.score-stack span { border: 1px solid var(--border); border-radius: .5rem; background: var(--bg-surface); padding: .35rem .4rem; text-align: center; }
.score-stack b { display: block; color: var(--text-1); font-size: 1rem; line-height: 1; }
.score-stack em { display: block; margin-top: .2rem; color: var(--text-3); font-size: .62rem; font-style: normal; font-weight: 900; letter-spacing: .12em; }
.dub-chip, .sub-chip, .delta-chip {
  border-radius: .4rem;
  padding: .28rem .45rem;
  font-family: ui-monospace, "Cascadia Mono", Menlo, monospace;
  font-size: .7rem;
  line-height: 1rem;
  font-weight: 900;
}
.dub-chip { background: color-mix(in oklch, var(--accent) 16%, transparent); color: var(--accent); border: 1px solid color-mix(in oklch, var(--accent) 56%, var(--border)); }
.sub-chip { background: color-mix(in oklch, var(--accent-alt) 16%, transparent); color: var(--accent-alt); border: 1px solid color-mix(in oklch, var(--accent-alt) 56%, var(--border)); }
.delta-chip { color: var(--warn); border: 1px solid color-mix(in oklch, var(--warn) 45%, var(--border)); background: color-mix(in oklch, var(--warn) 12%, transparent); }
.delta-muted { color: var(--text-3); border-color: var(--border); background: var(--bg-surface); }
.empty-state { padding: 5rem 0; color: var(--text-3); text-align: center; }
.pager { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: .75rem; margin-top: 2rem; }
.pager-count, .pager-state { color: var(--text-3); font-size: .875rem; line-height: 1.25rem; }
.pager-count { margin: 0; }
.pager-controls { display: flex; align-items: center; gap: .5rem; }
.pager-state { color: var(--text-2); padding: 0 .5rem; }
@media (max-width: 900px) {
  .hero-grid, .filter-inner { grid-template-columns: 1fr; }
  .genre-list { grid-column: auto; }
}
@media (max-width: 640px) {
  .site-wrap { width: min(100% - 1.25rem, 82rem); }
  .header-inner { align-items: stretch; }
  .header-nav { gap: .5rem; }
  .nav-link { display: none; }
  .brand-subtitle { display: none; }
  .filter-form { grid-template-columns: 1fr; }
  .filter-form .btn-primary { width: 100%; }
  .section-head { align-items: start; flex-direction: column; }
  .anime-row { grid-template-columns: 2.75rem minmax(0, 1fr) auto; }
  .score-stack { grid-column: 2 / -1; width: 100%; grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .delta-chip { display: none; }
  .dub-chip, .sub-chip { grid-column: 3; grid-row: 1; }
}
`;
