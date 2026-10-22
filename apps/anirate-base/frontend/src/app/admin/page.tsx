'use client';

// The back room: the dub-report queue first, then title edits, member moderation and
// the audit trail. Every action goes through the admin API, which re-checks the role.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { Providers } from '@/app/providers';
import { errorMessage } from '@/components/AuthLayout';
import { Colophon } from '@/components/collection/Colophon';
import { SiteHeader } from '@/components/SiteHeader';
import { adminApi, animeApi, type AdminUser, type AnimeDetail } from '@/lib/api';
import { useAuthStore } from '@/lib/auth.store';
import { formatCount, formatLabel, plural } from '@/lib/scores';

type Tab = 'dub' | 'titles' | 'members' | 'activity';

const TABS: Array<{ key: Tab; label: string }> = [
  { key: 'dub', label: 'Dub reports' },
  { key: 'titles', label: 'Titles' },
  { key: 'members', label: 'Members' },
  { key: 'activity', label: 'Activity' },
];

const dateFormat = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

export default function AdminPage() {
  return (
    <Providers>
      <Admin />
    </Providers>
  );
}

function Admin() {
  const { user, isLoading } = useAuthStore();
  const [tab, setTab] = useState<Tab>('dub');

  if (isLoading) {
    return (
      <div>
        <SiteHeader />
        <main id="main" className="wrap admin">
          <p className="muted" aria-busy="true">
            Checking your access…
          </p>
        </main>
      </div>
    );
  }

  if (user?.role !== 'admin') {
    return (
      <div>
        <SiteHeader />
        <main id="main" className="wrap admin">
          <div className="empty">
            <p className="title-m">This room is for admins.</p>
            <p className="muted">{user ? 'Your account does not have admin access.' : 'Sign in with an admin account to continue.'}</p>
            <a className="btn btn--ink btn--sm" href={user ? '/' : '/login'}>
              {user ? 'Back to the collection' : 'Sign in'}
            </a>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div>
      <SiteHeader />
      <main id="main" className="wrap admin">
        <div className="collection__head">
          <h1 className="title-l">Admin</h1>
        </div>
        <Overview />
        <nav className="tabs admin__tabs" aria-label="Admin sections">
          {TABS.map((entry) => (
            <button
              key={entry.key}
              type="button"
              className="tab"
              aria-current={tab === entry.key ? 'true' : undefined}
              onClick={() => setTab(entry.key)}
            >
              {entry.label}
            </button>
          ))}
        </nav>
        {tab === 'dub' ? <DubQueue /> : null}
        {tab === 'titles' ? <Titles /> : null}
        {tab === 'members' ? <Members selfId={user.id} /> : null}
        {tab === 'activity' ? <Activity /> : null}
      </main>
      <Colophon showInvitation={false} />
    </div>
  );
}

function Overview() {
  const dashboard = useQuery({ queryKey: ['admin', 'dashboard'], queryFn: async () => (await adminApi.dashboard()).data });
  const counts = dashboard.data?.counts;
  const stats: Array<[string, number | undefined]> = [
    ['Titles', counts?.totalAnime],
    ['Members', counts?.totalUsers],
    ['Ratings', counts?.totalRatings],
    ['Notes', counts?.totalComments],
    ['Titles with dub reports', counts?.pendingDubReports],
  ];

  return (
    <dl className="admin__stats">
      {stats.map(([label, value]) => (
        <div key={label} className="admin__stat">
          <dt className="signage muted">{label}</dt>
          <dd className="title-m num">{value === undefined ? '–' : formatCount(value)}</dd>
        </div>
      ))}
    </dl>
  );
}

function DubQueue() {
  const queryClient = useQueryClient();
  const queue = useQuery({ queryKey: ['admin', 'dub-reports'], queryFn: async () => (await adminApi.dubReports()).data });
  const decide = useMutation({
    mutationFn: ({ animeId, confirm }: { animeId: string; confirm: boolean }) =>
      confirm ? adminApi.confirmDub(animeId) : adminApi.dismissDub(animeId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin'] }),
  });

  if (queue.isLoading) return <p className="muted">Loading the queue…</p>;
  if (queue.isError) return <p className="notice notice--error">The queue could not be loaded.</p>;

  const items = queue.data?.items ?? [];
  return (
    <section className="admin__section" aria-labelledby="dub-title">
      <h2 id="dub-title" className="title-m">
        Dub reports
      </h2>
      <p className="muted admin__lede">
        Viewers report titles they watched with an English dub. {queue.data?.threshold} independent reports put a dub on record
        automatically; confirm sooner, or dismiss reports that are wrong.
      </p>
      {items.length === 0 ? (
        <p className="admin__empty muted">No open reports.</p>
      ) : (
        <ul className="admin__list">
          {items.map((item) => (
            <li key={item.anime.id} className="admin__row">
              <div>
                <a className="link admin__name" href={`/anime/${item.anime.id}`}>
                  {item.anime.title}
                </a>
                <p className="muted admin__meta">
                  {[item.anime.releaseYear, formatLabel(item.anime.format), plural(item.reports, 'report')].filter(Boolean).join(' · ')}
                </p>
              </div>
              <div className="admin__actions">
                <button
                  type="button"
                  className="btn btn--ink btn--sm"
                  disabled={decide.isPending}
                  onClick={() => decide.mutate({ animeId: item.anime.id, confirm: true })}
                >
                  Confirm dub
                </button>
                <button
                  type="button"
                  className="btn btn--line btn--sm"
                  disabled={decide.isPending}
                  onClick={() => decide.mutate({ animeId: item.anime.id, confirm: false })}
                >
                  Dismiss
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Titles() {
  const [search, setSearch] = useState('');
  const [submitted, setSubmitted] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const results = useQuery({
    queryKey: ['admin', 'titles', submitted],
    queryFn: async () => (await animeApi.list({ search: submitted, limit: 10 })).data,
    enabled: submitted.length > 0,
  });

  const onSearch = (event: FormEvent) => {
    event.preventDefault();
    setEditingId(null);
    setSubmitted(search.trim());
  };

  return (
    <section className="admin__section" aria-labelledby="titles-title">
      <h2 id="titles-title" className="title-m">
        Titles
      </h2>
      <form className="admin__search" onSubmit={onSearch} role="search">
        <label className="field__label signage" htmlFor="admin-title-search">
          Find a title
        </label>
        <div className="search">
          <input
            id="admin-title-search"
            className="input"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Any title, in English, Japanese or romaji"
          />
          <button className="btn btn--ink" type="submit">
            Search
          </button>
        </div>
      </form>

      {results.data ? (
        results.data.items.length ? (
          <ul className="admin__list">
            {results.data.items.map((anime) => (
              <li key={anime.id} className="admin__row admin__row--stack">
                <div className="admin__row-head">
                  <div>
                    <span className="admin__name">{anime.title}</span>
                    <p className="muted admin__meta">
                      {[anime.releaseYear, formatLabel(anime.format), anime.hasDub ? 'Dub on record' : 'No dub on record'].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="btn btn--line btn--sm"
                    aria-expanded={editingId === anime.id}
                    onClick={() => setEditingId(editingId === anime.id ? null : anime.id)}
                  >
                    {editingId === anime.id ? 'Close' : 'Edit'}
                  </button>
                </div>
                {editingId === anime.id ? <TitleEditor animeId={anime.id} onDone={() => setEditingId(null)} /> : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="admin__empty muted">No titles match.</p>
        )
      ) : null}
    </section>
  );
}

function TitleEditor({ animeId, onDone }: { animeId: string; onDone: () => void }) {
  const queryClient = useQueryClient();
  const detail = useQuery({ queryKey: ['anime', animeId], queryFn: async () => (await animeApi.get(animeId)).data });

  if (detail.isLoading) return <p className="muted">Loading…</p>;
  if (!detail.data) return <p className="notice notice--error">That title could not be loaded.</p>;

  return (
    <TitleForm
      anime={detail.data}
      onSaved={() => {
        queryClient.invalidateQueries({ queryKey: ['admin'] });
        queryClient.invalidateQueries({ queryKey: ['anime', animeId] });
        onDone();
      }}
    />
  );
}

function TitleForm({ anime, onSaved }: { anime: AnimeDetail; onSaved: () => void }) {
  const [title, setTitle] = useState(anime.title);
  const [description, setDescription] = useState(anime.description ?? '');
  const [coverImageUrl, setCoverImageUrl] = useState(anime.coverImageUrl ?? '');
  const [releaseYear, setReleaseYear] = useState(anime.releaseYear ? String(anime.releaseYear) : '');
  const [status, setStatus] = useState(anime.status);
  const [hasDub, setHasDub] = useState(anime.hasDub);
  const [error, setError] = useState('');

  const save = useMutation({
    mutationFn: () =>
      animeApi.update(anime.id, {
        title: title.trim(),
        ...(description.trim() ? { description: description.trim() } : {}),
        ...(coverImageUrl.trim() ? { coverImageUrl: coverImageUrl.trim() } : {}),
        ...(releaseYear ? { releaseYear: Number(releaseYear) } : {}),
        status,
        hasDub,
      }),
    onSuccess: onSaved,
    onError: (err) => setError(errorMessage(err, 'The changes did not save.')),
  });

  const remove = useMutation({
    mutationFn: () => animeApi.delete(anime.id),
    onSuccess: onSaved,
    onError: (err) => setError(errorMessage(err, 'The title was not deleted.')),
  });

  const id = (name: string) => `edit-${anime.id}-${name}`;

  return (
    <form
      className="admin__form"
      onSubmit={(event) => {
        event.preventDefault();
        setError('');
        save.mutate();
      }}
    >
      {error ? (
        <p role="alert" className="notice notice--error">
          {error}
        </p>
      ) : null}
      <div className="field">
        <label className="field__label signage" htmlFor={id('title')}>
          Title
        </label>
        <input id={id('title')} className="input" value={title} onChange={(event) => setTitle(event.target.value)} required maxLength={255} />
      </div>
      <label className="admin__check">
        <input type="checkbox" checked={hasDub} onChange={(event) => setHasDub(event.target.checked)} />
        <span>Has an English dub</span>
      </label>
      <div className="admin__form-row">
        <div className="field">
          <label className="field__label signage" htmlFor={id('year')}>
            Release year
          </label>
          <input
            id={id('year')}
            className="input"
            inputMode="numeric"
            value={releaseYear}
            onChange={(event) => setReleaseYear(event.target.value.replace(/\D/g, '').slice(0, 4))}
          />
        </div>
        <div className="field">
          <label className="field__label signage" htmlFor={id('status')}>
            Status
          </label>
          <select id={id('status')} className="input" value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="airing">Airing</option>
            <option value="completed">Completed</option>
            <option value="upcoming">Upcoming</option>
          </select>
        </div>
      </div>
      <div className="field">
        <label className="field__label signage" htmlFor={id('cover')}>
          Cover image URL (HTTPS)
        </label>
        <input id={id('cover')} className="input" type="url" value={coverImageUrl} onChange={(event) => setCoverImageUrl(event.target.value)} />
      </div>
      <div className="field">
        <label className="field__label signage" htmlFor={id('synopsis')}>
          Synopsis
        </label>
        <textarea
          id={id('synopsis')}
          className="input admin__textarea"
          value={description}
          maxLength={4000}
          onChange={(event) => setDescription(event.target.value)}
        />
      </div>
      <div className="admin__actions admin__actions--split">
        <button type="submit" className="btn btn--ink btn--sm" disabled={save.isPending}>
          {save.isPending ? 'Saving…' : 'Save changes'}
        </button>
        <button
          type="button"
          className="text-action"
          disabled={remove.isPending}
          onClick={() => {
            if (window.confirm(`Delete “${anime.title}” with all its ratings and notes? This cannot be undone.`)) {
              remove.mutate();
            }
          }}
        >
          Delete title
        </button>
      </div>
    </form>
  );
}

function Members({ selfId }: { selfId: string }) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [submitted, setSubmitted] = useState('');
  const [page, setPage] = useState(1);
  const members = useQuery({
    queryKey: ['admin', 'members', submitted, page],
    queryFn: async () => (await adminApi.users({ search: submitted || undefined, page })).data,
  });
  const [error, setError] = useState('');

  const moderate = useMutation({
    mutationFn: ({ member, ban }: { member: AdminUser; ban: boolean }) => {
      if (!ban) return adminApi.unban(member.id);
      const reason = window.prompt(`Why is ${member.username} being banned? (optional)`) ?? undefined;
      return adminApi.ban(member.id, reason && reason.trim().length >= 3 ? { reason: reason.trim() } : {});
    },
    onSuccess: () => {
      setError('');
      queryClient.invalidateQueries({ queryKey: ['admin'] });
    },
    onError: (err) => setError(errorMessage(err, 'That did not go through.')),
  });

  return (
    <section className="admin__section" aria-labelledby="members-title">
      <h2 id="members-title" className="title-m">
        Members
      </h2>
      <form
        className="admin__search"
        role="search"
        onSubmit={(event) => {
          event.preventDefault();
          setPage(1);
          setSubmitted(search.trim());
        }}
      >
        <label className="field__label signage" htmlFor="admin-member-search">
          Find a member
        </label>
        <div className="search">
          <input
            id="admin-member-search"
            className="input"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Username or email"
          />
          <button className="btn btn--ink" type="submit">
            Search
          </button>
        </div>
      </form>
      {error ? (
        <p role="alert" className="notice notice--error">
          {error}
        </p>
      ) : null}
      {members.data ? (
        <>
          <ul className="admin__list">
            {members.data.items.map((member) => (
              <li key={member.id} className="admin__row">
                <div>
                  <span className="admin__name">{member.username}</span>
                  <p className="muted admin__meta">
                    {[member.email, member.role === 'admin' ? 'Admin' : 'Member', member.isBanned ? 'Banned' : null].filter(Boolean).join(' · ')}
                  </p>
                </div>
                {member.role !== 'admin' && member.id !== selfId ? (
                  <div className="admin__actions">
                    <button
                      type="button"
                      className="btn btn--line btn--sm"
                      disabled={moderate.isPending}
                      onClick={() => moderate.mutate({ member, ban: !member.isBanned })}
                    >
                      {member.isBanned ? 'Lift ban' : 'Ban'}
                    </button>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
          {members.data.pagination.pages > 1 ? (
            <Pager page={page} pages={members.data.pagination.pages} onPage={setPage} />
          ) : null}
        </>
      ) : null}
    </section>
  );
}

function Activity() {
  const [page, setPage] = useState(1);
  const logs = useQuery({ queryKey: ['admin', 'logs', page], queryFn: async () => (await adminApi.logs(page)).data });

  return (
    <section className="admin__section" aria-labelledby="activity-title">
      <h2 id="activity-title" className="title-m">
        Activity
      </h2>
      {logs.data?.items.length === 0 ? <p className="admin__empty muted">No admin actions yet.</p> : null}
      <ul className="admin__list">
        {logs.data?.items.map((log) => (
          <li key={log.id} className="admin__row">
            <div>
              <span className="admin__name">{log.action.replace(/_/g, ' ').toLowerCase()}</span>
              <p className="muted admin__meta">
                {[log.admin?.username, log.targetType && log.targetId ? `${log.targetType} ${log.targetId}` : null, dateFormat.format(new Date(log.createdAt))]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
            </div>
          </li>
        ))}
      </ul>
      {logs.data && logs.data.pagination.pages > 1 ? <Pager page={page} pages={logs.data.pagination.pages} onPage={setPage} /> : null}
    </section>
  );
}

function Pager({ page, pages, onPage }: { page: number; pages: number; onPage: (page: number) => void }) {
  return (
    <nav className="pager" aria-label="Pages">
      <p className="pager__state muted num">
        Page {formatCount(page)} of {formatCount(pages)}
      </p>
      <div className="pager__controls">
        <button type="button" className="btn btn--line btn--sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          Previous
        </button>
        <button type="button" className="btn btn--line btn--sm" disabled={page >= pages} onClick={() => onPage(page + 1)}>
          Next
        </button>
      </div>
    </nav>
  );
}
