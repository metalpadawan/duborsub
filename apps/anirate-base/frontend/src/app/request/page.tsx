'use client';

// Request a title: for the anime someone could not find. Requests go to the admin
// queue, where they are reviewed and keyed into the catalogue. No account needed.
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState, type FormEvent } from 'react';
import { Providers } from '@/app/providers';
import { errorMessage } from '@/components/AuthLayout';
import { Colophon } from '@/components/collection/Colophon';
import { SiteHeader } from '@/components/SiteHeader';
import { titleRequestsApi, type TitleRequestResult } from '@/lib/api';
import { formatLabel } from '@/lib/scores';

export default function RequestPage() {
  return (
    <Providers>
      <div>
        <SiteHeader />
        <main id="main" className="wrap request">
          <header className="request__head">
            <h1 className="title-l">Request a title</h1>
            <p className="prose">
              The collection holds about 38,000 anime, but some slip through. Tell us what is missing and it will be reviewed and added,
              usually within a few days.
            </p>
          </header>
          <Suspense fallback={null}>
            <RequestForm />
          </Suspense>
        </main>
        <Colophon showInvitation={false} />
      </div>
    </Providers>
  );
}

function RequestForm() {
  const params = useSearchParams();
  const [title, setTitle] = useState(params?.get('title') ?? '');
  const [details, setDetails] = useState('');
  const [link, setLink] = useState('');
  // Left empty by people; filled in by form-filling bots, whose requests are dropped.
  const [website, setWebsite] = useState('');
  const [result, setResult] = useState<TitleRequestResult | null>(null);
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setSending(true);
    try {
      const { data } = await titleRequestsApi.create({
        title: title.trim(),
        ...(details.trim() ? { details: details.trim() } : {}),
        ...(link.trim() ? { link: link.trim() } : {}),
        ...(website ? { website } : {}),
      });
      setResult(data);
    } catch (err) {
      setError(errorMessage(err, 'The request did not go through. Try again in a moment.'));
    } finally {
      setSending(false);
    }
  };

  if (result) {
    return (
      <section className="request__done" aria-live="polite">
        <p className="notice notice--ok">
          {result.status === 'already-requested'
            ? `Someone has already asked for “${title.trim()}”, so your request was added to theirs. Titles asked for most are reviewed first.`
            : `Thanks. “${title.trim()}” is in the queue for review.`}
        </p>
        {result.possibleMatches.length ? (
          <div className="request__matches">
            <p className="signage muted">Could it be one of these?</p>
            <ul>
              {result.possibleMatches.map((match) => (
                <li key={match.id}>
                  <a className="link link--ruled" href={`/anime/${match.id}`}>
                    {match.title}
                  </a>{' '}
                  <span className="muted">{[match.releaseYear, formatLabel(match.format)].filter(Boolean).join(' · ')}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        <p className="request__actions">
          <button
            type="button"
            className="btn btn--line btn--sm"
            onClick={() => {
              setResult(null);
              setTitle('');
              setDetails('');
              setLink('');
            }}
          >
            Request another
          </button>
          <Link className="link link--ruled" href="/">
            Back to the collection
          </Link>
        </p>
      </section>
    );
  }

  return (
    <form className="form request__form" onSubmit={submit}>
      {error ? (
        <p role="alert" className="notice notice--error">
          {error}
        </p>
      ) : null}
      <div className="field">
        <label className="field__label signage" htmlFor="request-title">
          Title
        </label>
        <input
          id="request-title"
          className="input"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          required
          maxLength={255}
          placeholder="English, Japanese or romaji"
          autoComplete="off"
        />
      </div>
      <div className="field">
        <label className="field__label signage" htmlFor="request-details">
          Anything that helps find it <span className="muted">(optional)</span>
        </label>
        <textarea
          id="request-details"
          className="input request__textarea"
          value={details}
          onChange={(event) => setDetails(event.target.value)}
          maxLength={1000}
          placeholder="Year, studio, season, other names…"
        />
      </div>
      <div className="field">
        <label className="field__label signage" htmlFor="request-link">
          A link to it <span className="muted">(optional)</span>
        </label>
        <input
          id="request-link"
          className="input"
          type="url"
          inputMode="url"
          value={link}
          onChange={(event) => setLink(event.target.value)}
          placeholder="https://anilist.co/anime/…"
        />
      </div>
      <div className="request__trap" aria-hidden="true">
        <label htmlFor="request-website">Website</label>
        <input id="request-website" tabIndex={-1} autoComplete="off" value={website} onChange={(event) => setWebsite(event.target.value)} />
      </div>
      <p>
        <button type="submit" className="btn btn--ink" disabled={sending || !title.trim()}>
          {sending ? 'Sending…' : 'Send request'}
        </button>
      </p>
    </form>
  );
}
