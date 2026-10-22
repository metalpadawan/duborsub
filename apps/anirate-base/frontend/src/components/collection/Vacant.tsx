// An empty hook on the wall: shared by the 404 pages and the missing-work state.
import { Icon } from './Icon';

export function Vacant({
  title = 'Nothing hangs here.',
  body = 'This page is not part of the collection. It may have moved, or the address may be mistyped.',
}: {
  title?: string;
  body?: string;
}) {
  return (
    <main id="main" className="wrap vacant">
      <div className="vacant__frame" aria-hidden="true">
        <span className="signage muted">Vacant</span>
      </div>
      <div style={{ display: 'grid', gap: '1.25rem' }}>
        <h1 className="title-xl">{title}</h1>
        <p className="prose">{body}</p>
        <p>
          <a className="btn btn--ink" href="/">
            Back to the collection
            <Icon name="arrow-right" className="btn__arrow" />
          </a>
        </p>
      </div>
    </main>
  );
}
