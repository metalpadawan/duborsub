// The Collection: the AniRate catalogue as a gallery checklist.
// Server-rendered with no React runtime; one small inline script adds the "/"
// search shortcut, and every motion here is CSS that the page reads fine without.
import type { GetStaticProps } from 'next';
import Head from 'next/head';
import type { CSSProperties } from 'react';
import { Colophon } from '@/components/collection/Colophon';
import { Icon } from '@/components/collection/Icon';
import { Masthead, SignedOutLinks } from '@/components/collection/Masthead';
import { Measure, VerdictTag } from '@/components/collection/Measure';
import { Provenance } from '@/components/collection/Provenance';
import { WorkImage } from '@/components/collection/WorkImage';
import type { Anime } from '@/lib/api';
import { defaultSortFor, PAGE_SIZE, sortLabels, type HomeProps, type SortKey, type ZeroJsPageConfig } from '@/lib/catalog-view';
import { isSampleRecord } from '@/lib/provenance';
import { describeSplit, formatCount, formatLabel, formatStatus, plural, workTransitionName } from '@/lib/scores';

export const config: ZeroJsPageConfig = {
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

const SORT_ORDER: SortKey[] = ['popular', 'rating', 'votes', 'year', 'title'];
const SEARCH_SORT_ORDER: SortKey[] = ['relevance', ...SORT_ORDER];

export default function HomePage({ search, sort, genre, genres, items, featured, page, totalItems, totalPages }: HomeProps) {
  const startItem = totalItems === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const endItem = Math.min(page * PAGE_SIZE, totalItems);
  const filtered = Boolean(search || genre);
  const rankings = sort === 'rating' && !filtered;
  const pageTitle = search
    ? `“${search}” in the collection · AniRate`
    : rankings
      ? 'Rankings · AniRate'
      : page > 1
      ? `The collection, page ${page} · AniRate`
      : 'AniRate — Two versions. Two scores.';

  return (
    <>
      <Head>
        <title>{pageTitle}</title>
        <meta
          name="description"
          content="AniRate rates the subtitled and dubbed release of every anime separately, so you can choose the version worth watching."
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <a className="skip-link" href="#collection">
        Skip to the collection
      </a>

      <Masthead current={rankings ? 'rankings' : 'collection'} auth={<SignedOutLinks />} />

      <main id="main">
        <section className="wrap hero" aria-labelledby="hero-title">
          <div className="grid hero__grid">
            <div className="hero__copy rise">
              <h1 id="hero-title" className="display">
                Two versions.
                <br />
                Two scores.
              </h1>
              <p className="lede">
                AniRate rates the subtitled and the dubbed release of every anime separately, so you can choose the version worth your evening.
              </p>
              <SearchForm search={search} sort={sort} genre={genre} />
            </div>

            {featured ? <FeaturedWork anime={featured} /> : null}
          </div>
        </section>

        <section id="collection" className="wrap collection" aria-labelledby="collection-title">
          <div className="collection__head">
            <h2 id="collection-title" className="title-l">
              {search ? `Results for “${search}”` : genre ? genre : rankings ? 'Rankings' : 'The collection'}
            </h2>
            <p className="collection__count muted num" aria-live="polite">
              {totalItems === 0
                ? 'No works match'
                : `${formatCount(startItem)}–${formatCount(endItem)} of ${plural(totalItems, 'work')}`}
            </p>
          </div>

          <div className="controls">
            <div className="controls__row">
              <span className="controls__name signage" id="sort-label">
                Sort
              </span>
              <nav className="tabs" aria-labelledby="sort-label">
                {(search ? SEARCH_SORT_ORDER : SORT_ORDER).map((key) => (
                  <a
                    key={key}
                    className="tab"
                    href={getSearchHref({ search, sort: key, genre })}
                    aria-current={sort === key ? 'page' : undefined}
                  >
                    {sortLabels[key]}
                  </a>
                ))}
              </nav>
            </div>
            <div className="controls__row">
              <span className="controls__name signage" id="genre-label">
                Genre
              </span>
              <nav className="genres" aria-labelledby="genre-label">
                {genres.map((option) => {
                  const value = option === 'All' ? '' : option;
                  return (
                    <a
                      key={option}
                      className="tab"
                      href={getSearchHref({ search, sort, genre: value })}
                      aria-current={genre === value ? 'page' : undefined}
                    >
                      {option}
                    </a>
                  );
                })}
              </nav>
            </div>
          </div>

          {items.length > 0 ? (
            <>
              <div className="checklist__cols signage" aria-hidden="true">
                <span />
                <span>Work</span>
                <span>Sub</span>
                <span>Dub</span>
                <span>Leads</span>
              </div>
              <ol className="checklist" start={startItem}>
                {items.map((anime) => (
                  <li key={anime.id}>
                    <Entry anime={anime} morph={anime.id !== featured?.id} />
                  </li>
                ))}
              </ol>
            </>
          ) : sort === 'rating' ? (
            <div className="empty">
              <p className="title-m">{filtered ? 'None of these has been rated yet.' : 'Nothing has been rated yet.'}</p>
              <p className="muted">The rankings fill as viewers rate the sub and the dub. Find a work you have seen and rate it first.</p>
              <a className="btn btn--line btn--sm" href="/">
                Browse the collection
              </a>
            </div>
          ) : (
            <div className="empty">
              <p className="title-m">Nothing in the collection matches that.</p>
              <p className="muted">Try a shorter title, or clear the filters to see every work.</p>
              <a className="btn btn--line btn--sm" href="/">
                Clear filters
              </a>
            </div>
          )}

          {totalPages > 1 ? (
            <nav className="pager" aria-label="Collection pages">
              <p className="pager__state muted num">
                Page {formatCount(page)} of {formatCount(totalPages)}
              </p>
              <div className="pager__controls">
                <PagerLink href={page > 1 ? getPageHref({ search, sort, genre, page: page - 1 }) : null} direction="previous" />
                <PagerLink href={page < totalPages ? getPageHref({ search, sort, genre, page: page + 1 }) : null} direction="next" />
              </div>
            </nav>
          ) : null}
        </section>
      </main>

      <Colophon />

      <script dangerouslySetInnerHTML={{ __html: SEARCH_SHORTCUT }} />
    </>
  );
}

function SearchForm({ search, sort, genre }: { search: string; sort: SortKey; genre: string }) {
  return (
    <form className="hero__search" action="/catalog/search" role="search">
      <label className="field__label signage" htmlFor="q">
        Search the collection
      </label>
      <div className="search">
        <input
          id="q"
          name="q"
          type="search"
          className="input"
          placeholder="Search any title, in English, Japanese or romaji"
          defaultValue={search}
          autoComplete="off"
          aria-keyshortcuts="/"
        />
        {/* A new search starts on "Best match" unless a ranking was chosen. */}
        {sort !== 'popular' && sort !== 'relevance' ? <input type="hidden" name="sort" value={sort} /> : null}
        {genre ? <input type="hidden" name="genre" value={genre} /> : null}
        <button className="btn btn--ink" type="submit">
          Search
        </button>
      </div>
      <p className="search__hint muted">
        Press <kbd>/</kbd> to search from anywhere on the page.
      </p>
    </form>
  );
}

// The hero's hung work: unveiled onto the wall, then labelled and measured.
function FeaturedWork({ anime }: { anime: Anime }) {
  const split = describeSplit(anime.avgSubRating, anime.avgDubRating);
  const href = `/anime/${anime.id}`;
  const meta = [anime.releaseYear, formatLabel(anime.format), formatStatus(anime.status), anime.genres.slice(0, 2).map((g) => g.name).join(', ')]
    .filter(Boolean)
    .join(' · ');

  return (
    <figure className="hero__work hang" aria-label={`Featured work: ${anime.title}`}>
      <div className="hung">
        <a
          className="work"
          href={href}
          tabIndex={-1}
          aria-hidden="true"
          style={{ viewTransitionName: workTransitionName(anime.id) } as CSSProperties}
        >
          <span className="work__canvas" style={{ display: 'block' }}>
            <WorkImage title={anime.title} src={anime.coverImageUrl} priority decorative titled />
          </span>
        </a>

        <figcaption className="label-card">
          <p className="label-line label-card__title">
            <a className="link" href={href}>
              {anime.title}
            </a>
          </p>
          <p className="label-line label-card__meta muted">
            {meta}
            <Provenance anime={anime} className="provenance provenance--label" />
          </p>
          <div className="label-line label-card__measures">
            <Measure version="sub" value={split.sub} lead={split.lead === 'sub'} emptyLabel="Not rated" />
            <Measure version="dub" value={split.dub} lead={split.lead === 'dub'} delay={140} emptyLabel="Not rated" />
          </div>
          <p className="label-line" style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', fontSize: '0.9375rem' }}>
            <span>
              {split.lead === 'sub' || split.lead === 'dub' ? (
                <VerdictTag tag={`${split.lead === 'sub' ? 'Sub' : 'Dub'} leads by ${split.gap?.toFixed(1)}`} lead={split.lead} />
              ) : split.lead === 'even' ? (
                <VerdictTag tag="Sub and dub level" lead="even" />
              ) : (
                <span className="muted">{split.tag === 'Unrated' ? 'Not yet rated' : `${split.tag} so far`}</span>
              )}
            </span>
            <a className="link link--ruled" href={href} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
              View the work
              <Icon name="arrow-right" className="btn__arrow" />
            </a>
          </p>
        </figcaption>
      </div>
    </figure>
  );
}

function Entry({ anime, morph }: { anime: Anime; morph: boolean }) {
  const split = describeSplit(anime.avgSubRating, anime.avgDubRating);
  const meta = [anime.releaseYear, formatLabel(anime.format), formatStatus(anime.status), anime.genres.slice(0, 2).map((g) => g.name).join(', ')]
    .filter(Boolean)
    .join(' · ');

  return (
    <a className="entry" href={`/anime/${anime.id}`}>
      <span
        className="thumb"
        style={morph ? ({ viewTransitionName: workTransitionName(anime.id) } as CSSProperties) : undefined}
      >
        <WorkImage title={anime.title} src={anime.coverImageUrl} decorative />
      </span>
      <span className="entry__main">
        <span className="entry__title" style={{ display: 'block' }}>
          {anime.title}
          {isSampleRecord(anime.id) ? <span className="tag signage">Sample</span> : null}
        </span>
        <span className="entry__meta" style={{ display: 'block' }}>
          {meta}
        </span>
      </span>
      {split.sub === null && split.dub === null ? (
        // Nothing to compare yet: one honest line instead of a row of dashes.
        <span className="entry__none">No ratings yet</span>
      ) : (
        <>
          <Measure version="sub" value={split.sub} lead={split.lead === 'sub'} />
          {split.dub === null && !anime.hasDub ? (
            <span className="measure measure--dub measure--empty">
              <span className="measure__head">
                <span className="measure__name signage">Dub</span>
                <span className="measure__value measure__value--text">Not listed</span>
              </span>
            </span>
          ) : (
            <Measure version="dub" value={split.dub} lead={split.lead === 'dub'} />
          )}
          <span className="entry__verdict">
            <VerdictTag tag={split.tag} lead={split.lead} />
          </span>
        </>
      )}
    </a>
  );
}

function PagerLink({ href, direction }: { href: string | null; direction: 'previous' | 'next' }) {
  const label = direction === 'previous' ? 'Previous' : 'Next';
  const icon = <Icon name={direction === 'previous' ? 'arrow-left' : 'arrow-right'} />;

  if (!href) {
    return (
      <span className="btn btn--line btn--sm" aria-disabled="true">
        {direction === 'previous' ? icon : null}
        {label}
        {direction === 'next' ? icon : null}
      </span>
    );
  }

  return (
    <a className="btn btn--line btn--sm" href={href} rel={direction === 'previous' ? 'prev' : 'next'}>
      {direction === 'previous' ? icon : null}
      {label}
      {direction === 'next' ? icon : null}
    </a>
  );
}

function getPageHref({ search, sort, genre, page }: { search: string; sort: SortKey; genre: string; page: number }) {
  if (search || genre || sort !== 'popular') {
    return getSearchHref({ search, sort, genre, page });
  }

  return page <= 1 ? '/#collection' : `/catalog/${page}#collection`;
}

function getSearchHref({ search, sort, genre, page }: { search: string; sort: SortKey; genre: string; page?: number }) {
  const params = new URLSearchParams();

  if (search) {
    params.set('q', search);
  }

  if (sort !== defaultSortFor(search)) {
    params.set('sort', sort);
  }

  if (genre) {
    params.set('genre', genre);
  }

  if (page && page > 1) {
    params.set('page', String(page));
  }

  const query = params.toString();
  if (!query) {
    return '/#collection';
  }

  return `/catalog/search?${query}#collection`;
}

// "/" focuses search from anywhere unless the visitor is already typing; Escape leaves it.
const SEARCH_SHORTCUT = `(function(){var q=document.getElementById('q');if(!q)return;document.addEventListener('keydown',function(e){if(e.key==='Escape'&&document.activeElement===q){q.blur();return;}if(e.key!=='/'||e.metaKey||e.ctrlKey||e.altKey)return;var t=e.target;if(t&&(t.isContentEditable||/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)))return;e.preventDefault();q.focus();q.select();});})();`;
