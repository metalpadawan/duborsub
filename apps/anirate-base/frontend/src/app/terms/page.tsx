import type { Metadata } from 'next';
import { ContactLine, LegalPage } from '@/components/collection/LegalPage';

export const metadata: Metadata = {
  title: 'Terms',
  description: 'The rules for using AniRate: accounts, ratings, notes and the catalogue.',
};

// A plain-language starting point; review it with a lawyer before launch.
export default function TermsPage() {
  return (
    <LegalPage title="Terms" updated="22 October 2026">
      <p>By using AniRate you agree to these terms. They are short, and written to be read.</p>

      <h2>Your account</h2>
      <ul>
        <li>You need to be at least 13 to make an account, and must give an email address you can confirm.</li>
        <li>Keep your password to yourself. You are responsible for what is done with your account.</li>
        <li>One account per person. Accounts made to inflate ratings or dub reports are removed.</li>
      </ul>

      <h2>What you post</h2>
      <ul>
        <li>Rate what you have actually watched, and say honestly whether a title has an English dub.</li>
        <li>
          Notes must not harass anyone, contain hate speech, spoil plots without warning, advertise, or break the law. No links to pirated
          streams or downloads.
        </li>
        <li>
          You keep ownership of your notes, and allow AniRate to show them on the site. Admins may remove notes and suspend accounts that break
          these rules.
        </li>
      </ul>

      <h2>The catalogue</h2>
      <p>
        Titles and metadata come from open sources: anime-offline-database (under the Open Database License), AniList and Kitsu. Cover art
        belongs to its rights holders. AniRate does not host or link to video. If you hold rights in something shown here and want it changed
        or removed, contact <ContactLine />.
      </p>

      <h2>No guarantees</h2>
      <p>
        AniRate is provided as it is. Ratings are opinions from the community, not professional reviews, and the site may change, pause or
        lose data despite best efforts. To the extent the law allows, AniRate is not liable for losses arising from using it.
      </p>

      <h2>Ending things</h2>
      <p>
        You can delete your account whenever you like from <a className="link link--ruled" href="/my-ratings">My ratings</a>. AniRate may close
        accounts that break these terms.
      </p>

      <h2>Changes</h2>
      <p>If these terms change in a way that matters, the date above changes and signed-in members are told on the site.</p>
    </LegalPage>
  );
}
