// The frame for the privacy and terms pages: plain reading layout on the wall.
import type { ReactNode } from 'react';
import { Colophon } from './Colophon';
import { Masthead, SignedOutLinks } from './Masthead';

// Set NEXT_PUBLIC_CONTACT_EMAIL to publish an address for privacy and legal questions.
export const CONTACT_EMAIL = process.env.NEXT_PUBLIC_CONTACT_EMAIL?.trim() || null;

export function ContactLine() {
  return CONTACT_EMAIL ? (
    <a className="link link--ruled" href={`mailto:${CONTACT_EMAIL}`}>
      {CONTACT_EMAIL}
    </a>
  ) : (
    <>
      the{' '}
      <a className="link link--ruled" href="/request">
        request form
      </a>
      , starting the title with &ldquo;Privacy&rdquo;
    </>
  );
}

export function LegalPage({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  return (
    <>
      <Masthead auth={<SignedOutLinks />} />
      <main id="main" className="wrap legal">
        <header className="legal__head">
          <h1 className="title-l">{title}</h1>
          <p className="muted">Last updated {updated}</p>
        </header>
        <div className="legal__body prose">{children}</div>
      </main>
      <Colophon showInvitation={false} />
    </>
  );
}
