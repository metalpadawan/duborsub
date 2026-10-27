'use client';

// The back room: the dub-report queue first, then title edits, member moderation and
// the audit trail. Every action goes through the admin API, which re-checks the role.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { Providers } from '@/app/providers';
import { errorMessage } from '@/components/AuthLayout';
import { Colophon } from '@/components/collection/Colophon';
import { SiteHeader } from '@/components/SiteHeader';
import { adminApi, animeApi, type AdminComment, type AdminTitleRequest, type AdminUser, type AnimeDetail } from '@/lib/api';
import { useAuthStore } from '@/lib/auth.store';
import { formatCount, formatLabel, plural } from '@/lib/scores';

type Tab = 'requests' | 'dub' | 'notes' | 'titles' | 'members' | 'activity';

const TABS: Array<{ key: Tab; label: string }> = [
  { key: 'requests', label: 'Requests' },
  { key: 'dub', label: 'Dub reports' },
  { key: 'notes', label: 'Notes' },
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
  const [tab, setTab] = useState<Tab>('requests');

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
        {tab === 'requests' ? <Requests /> : null}
        {tab === 'dub' ? <DubQueue /> : null}
        {tab === 'notes' ? <Notes /> : null}
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
    ['Titles requested', counts?.pendingTitleRequests],
    ['Titles with dub reports', counts?.pendingDubReports],
    ['Notes reported', counts?.reportedComments],
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
      initial={valuesFrom(detail.data)}
      animeId={animeId}
      onSaved={() => {
        queryClient.invalidateQueries({ queryKey: ['admin'] });
        queryClient.invalidateQueries({ queryKey: ['anime', animeId] });
        onDone();
      }}
    />
  );
}

type TitleValues = {
  title: string;
  alternativeTitles: string;
  format: string;
  episodes: string;
  releaseYear: string;
  status: string;
  hasDub: boolean;
  coverImageUrl: string;
  description: string;
};

const EMPTY_TITLE: TitleValues = {
  title: '',
  alternativeTitles: '',
  format: 'TV',
  episodes: '',
  releaseYear: '',
  status: 'completed',
  hasDub: false,
  coverImageUrl: '',
  description: '',
};

function valuesFrom(anime: AnimeDetail): TitleValues {
  return {
    title: anime.title,
    alternativeTitles: (anime.alternativeTitles ?? []).join('\n'),
    format: anime.format ?? '',
    episodes: anime.episodes ? String(anime.episodes) : '',
    releaseYear: anime.releaseYear ? String(anime.releaseYear) : '',
    status: anime.status,
    hasDub: anime.hasDub,
    coverImageUrl: anime.coverImageUrl ?? '',
    description: anime.description ?? '',
  };
}

// One form for keying in a new title and for editing an existing one.
function TitleForm({
  initial,
  animeId,
  onSaved,
  submitLabel = 'Save changes',
}: {
  initial: TitleValues;
  animeId?: string;
  onSaved: (animeId: string) => void;
  submitLabel?: string;
}) {
  const [values, setValues] = useState(initial);
  const [error, setError] = useState('');
  const set = <K extends keyof TitleValues>(key: K, value: TitleValues[K]) => setValues((current) => ({ ...current, [key]: value }));

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        title: values.title.trim(),
        alternativeTitles: values.alternativeTitles
          .split('\n')
          .map((name) => name.trim())
          .filter(Boolean),
        ...(values.format ? { format: values.format } : {}),
        ...(values.episodes ? { episodes: Number(values.episodes) } : {}),
        ...(values.description.trim() ? { description: values.description.trim() } : {}),
        ...(values.coverImageUrl.trim() ? { coverImageUrl: values.coverImageUrl.trim() } : {}),
        ...(values.releaseYear ? { releaseYear: Number(values.releaseYear) } : {}),
        status: values.status,
        hasDub: values.hasDub,
      };
      return animeId ? (await animeApi.update(animeId, payload)).data : (await animeApi.create(payload)).data;
    },
    onSuccess: (anime) => onSaved(anime.id),
    onError: (err) => setError(errorMessage(err, 'The title did not save.')),
  });

  const remove = useMutation({
    mutationFn: () => animeApi.delete(animeId as string),
    onSuccess: () => onSaved(animeId as string),
    onError: (err) => setError(errorMessage(err, 'The title was not deleted.')),
  });

  const id = (name: string) => `title-${animeId ?? 'new'}-${name}`;

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
        <input id={id('title')} className="input" value={values.title} onChange={(event) => set('title', event.target.value)} required maxLength={255} />
      </div>
      <div className="field">
        <label className="field__label signage" htmlFor={id('names')}>
          Other names, one per line (searchable)
        </label>
        <textarea
          id={id('names')}
          className="input admin__textarea admin__textarea--short"
          value={values.alternativeTitles}
          onChange={(event) => set('alternativeTitles', event.target.value)}
          placeholder={'Romaji title\nJapanese title'}
        />
      </div>
      <label className="admin__check">
        <input type="checkbox" checked={values.hasDub} onChange={(event) => set('hasDub', event.target.checked)} />
        <span>Has an English dub</span>
      </label>
      <div className="admin__form-row">
        <div className="field">
          <label className="field__label signage" htmlFor={id('format')}>
            Format
          </label>
          <select id={id('format')} className="input" value={values.format} onChange={(event) => set('format', event.target.value)}>
            <option value="TV">TV</option>
            <option value="MOVIE">Movie</option>
            <option value="OVA">OVA</option>
            <option value="ONA">Web series</option>
            <option value="SPECIAL">Special</option>
          </select>
        </div>
        <div className="field">
          <label className="field__label signage" htmlFor={id('episodes')}>
            Episodes
          </label>
          <input
            id={id('episodes')}
            className="input"
            inputMode="numeric"
            value={values.episodes}
            onChange={(event) => set('episodes', event.target.value.replace(/\D/g, '').slice(0, 5))}
          />
        </div>
        <div className="field">
          <label className="field__label signage" htmlFor={id('year')}>
            Release year
          </label>
          <input
            id={id('year')}
            className="input"
            inputMode="numeric"
            value={values.releaseYear}
            onChange={(event) => set('releaseYear', event.target.value.replace(/\D/g, '').slice(0, 4))}
          />
        </div>
        <div className="field">
          <label className="field__label signage" htmlFor={id('status')}>
            Status
          </label>
          <select id={id('status')} className="input" value={values.status} onChange={(event) => set('status', event.target.value)}>
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
        <input id={id('cover')} className="input" type="url" value={values.coverImageUrl} onChange={(event) => set('coverImageUrl', event.target.value)} />
      </div>
      <div className="field">
        <label className="field__label signage" htmlFor={id('synopsis')}>
          Synopsis
        </label>
        <textarea
          id={id('synopsis')}
          className="input admin__textarea"
          value={values.description}
          maxLength={4000}
          onChange={(event) => set('description', event.target.value)}
        />
      </div>
      <div className="admin__actions admin__actions--split">
        <button type="submit" className="btn btn--ink btn--sm" disabled={save.isPending || !values.title.trim()}>
          {save.isPending ? 'Saving…' : submitLabel}
        </button>
        {animeId ? (
          <button
            type="button"
            className="text-action"
            disabled={remove.isPending}
            onClick={() => {
              if (window.confirm(`Delete “${values.title}” with all its ratings and notes? This cannot be undone.`)) {
                remove.mutate();
              }
            }}
          >
            Delete title
          </button>
        ) : null}
      </div>
    </form>
  );
}

// Titles visitors could not find, most requested first. Adding one keys it into the
// catalogue from the request; rejecting can carry a short note.
function Requests() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<'pending' | 'added' | 'rejected'>('pending');
  const [page, setPage] = useState(1);
  const [adding, setAdding] = useState<string | null>(null);
  const requests = useQuery({
    queryKey: ['admin', 'requests', status, page],
    queryFn: async () => (await adminApi.titleRequests(status, page)).data,
  });

  const resolve = useMutation({
    mutationFn: (input: { id: string; status: 'added' | 'rejected'; animeId?: string; note?: string }) =>
      adminApi.resolveTitleRequest(input.id, { status: input.status, animeId: input.animeId, note: input.note }),
    onSuccess: () => {
      setAdding(null);
      queryClient.invalidateQueries({ queryKey: ['admin'] });
    },
  });

  return (
    <section className="admin__section" aria-labelledby="requests-title">
      <h2 id="requests-title" className="title-m">
        Requested titles
      </h2>
      <p className="muted admin__lede">
        Anime people searched for and could not find. Check the catalogue first; if it is really missing, add it here and the request is
        marked done.
      </p>
      <nav className="tabs" aria-label="Request status">
        {(['pending', 'added', 'rejected'] as const).map((value) => (
          <button
            key={value}
            type="button"
            className="tab"
            aria-current={status === value ? 'true' : undefined}
            onClick={() => {
              setStatus(value);
              setPage(1);
            }}
          >
            {value === 'pending' ? 'Waiting' : value === 'added' ? 'Added' : 'Rejected'}
          </button>
        ))}
      </nav>
      {requests.isLoading ? <p className="muted">Loading…</p> : null}
      {requests.data && requests.data.items.length === 0 ? <p className="admin__empty muted">Nothing here.</p> : null}
      {requests.data?.items.length ? (
        <ul className="admin__list">
          {requests.data.items.map((request) => (
            <li key={request.id} className="admin__row admin__row--stack">
              <RequestRow
                request={request}
                adding={adding === request.id}
                busy={resolve.isPending}
                onAdd={() => setAdding(adding === request.id ? null : request.id)}
                onReject={() => {
                  const note = window.prompt(`Why is “${request.title}” not being added? (optional)`);
                  if (note !== null) resolve.mutate({ id: request.id, status: 'rejected', note: note.trim() || undefined });
                }}
              />
              {adding === request.id ? (
                <TitleForm
                  initial={{ ...EMPTY_TITLE, title: request.title, description: '' }}
                  submitLabel="Add to the catalogue"
                  onSaved={(animeId) => resolve.mutate({ id: request.id, status: 'added', animeId })}
                />
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
      {requests.data && requests.data.pagination.pages > 1 ? (
        <Pager page={page} pages={requests.data.pagination.pages} onPage={setPage} />
      ) : null}
    </section>
  );
}

function RequestRow({
  request,
  adding,
  busy,
  onAdd,
  onReject,
}: {
  request: AdminTitleRequest;
  adding: boolean;
  busy: boolean;
  onAdd: () => void;
  onReject: () => void;
}) {
  const meta = [
    request.requestCount > 1 ? `Asked for ${request.requestCount} times` : 'Asked for once',
    request.user ? `by ${request.user.username}` : 'without an account',
    dateFormat.format(new Date(request.createdAt)),
  ].join(' · ');

  return (
    <div className="admin__row-head">
      <div>
        <span className="admin__name">{request.title}</span>
        <p className="muted admin__meta">{meta}</p>
        {request.details ? <p className="admin__detail">{request.details}</p> : null}
        {request.link ? (
          <p className="admin__detail">
            <a className="link link--ruled" href={request.link} target="_blank" rel="noopener noreferrer nofollow">
              {request.link}
            </a>
          </p>
        ) : null}
        {request.adminNote ? <p className="admin__detail muted">Note: {request.adminNote}</p> : null}
        {request.animeId ? (
          <p className="admin__detail">
            <a className="link link--ruled" href={`/anime/${request.animeId}`}>
              View the added title
            </a>
          </p>
        ) : null}
      </div>
      {request.status === 'pending' ? (
        <div className="admin__actions">
          <a className="btn btn--line btn--sm" href={`/catalog/search?q=${encodeURIComponent(request.title)}`} target="_blank" rel="noreferrer">
            Check the catalogue
          </a>
          <button type="button" className="btn btn--ink btn--sm" aria-expanded={adding} onClick={onAdd} disabled={busy}>
            {adding ? 'Close' : 'Add to catalogue'}
          </button>
          <button type="button" className="text-action" onClick={onReject} disabled={busy}>
            Reject
          </button>
        </div>
      ) : null}
    </div>
  );
}

// Reported notes first, then the latest notes, each removable by a moderator.
function Notes() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const reports = useQuery({ queryKey: ['admin', 'comment-reports'], queryFn: async () => (await adminApi.commentReports()).data });
  const recent = useQuery({ queryKey: ['admin', 'comments', page], queryFn: async () => (await adminApi.recentComments(page)).data });

  const act = useMutation({
    mutationFn: ({ commentId, remove }: { commentId: string; remove: boolean }) =>
      remove ? adminApi.removeComment(commentId) : adminApi.dismissCommentReports(commentId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin'] }),
  });

  const row = (comment: AdminComment, reasons?: string[]) => (
    <li key={comment.id} className="admin__row">
      <div>
        <p className="admin__detail">{comment.isDeleted ? <span className="muted">(removed)</span> : comment.content}</p>
        <p className="muted admin__meta">
          {[
            comment.user?.username ?? 'Former member',
            comment.anime.title,
            dateFormat.format(new Date(comment.createdAt)),
            comment.reports ? plural(comment.reports, 'report') : null,
          ]
            .filter(Boolean)
            .join(' · ')}
        </p>
        {reasons?.length ? <p className="admin__detail muted">Reasons: {reasons.join('; ')}</p> : null}
      </div>
      {!comment.isDeleted ? (
        <div className="admin__actions">
          <button
            type="button"
            className="btn btn--line btn--sm"
            disabled={act.isPending}
            onClick={() => window.confirm('Remove this note? Its author sees it marked as removed by a moderator.') && act.mutate({ commentId: comment.id, remove: true })}
          >
            Remove
          </button>
          {reasons ? (
            <button type="button" className="text-action" disabled={act.isPending} onClick={() => act.mutate({ commentId: comment.id, remove: false })}>
              Dismiss reports
            </button>
          ) : null}
        </div>
      ) : null}
    </li>
  );

  return (
    <section className="admin__section" aria-labelledby="notes-admin-title">
      <h2 id="notes-admin-title" className="title-m">
        Reported notes
      </h2>
      {reports.data?.items.length ? (
        <ul className="admin__list">{reports.data.items.map((comment) => row(comment, comment.reasons))}</ul>
      ) : (
        <p className="admin__empty muted">No reported notes.</p>
      )}
      <h2 className="title-m">Latest notes</h2>
      {recent.data?.items.length ? <ul className="admin__list">{recent.data.items.map((comment) => row(comment))}</ul> : <p className="admin__empty muted">No notes yet.</p>}
      {recent.data && recent.data.pagination.pages > 1 ? <Pager page={page} pages={recent.data.pagination.pages} onPage={setPage} /> : null}
    </section>
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
