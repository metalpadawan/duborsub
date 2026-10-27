import type { Metadata } from 'next';
import { ContactLine, LegalPage } from '@/components/collection/LegalPage';

export const metadata: Metadata = {
  title: 'Privacy',
  description: 'What AniRate collects, why, how long it keeps it, and how to have it deleted.',
};

// Written to match what the code actually does; review it with a lawyer before launch.
export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy" updated="22 October 2026">
      <p>
        AniRate collects as little as it can to let you rate anime, leave notes and keep an account. There are no adverts, no analytics and no
        tracking scripts, and nothing about you is sold or shared for marketing.
      </p>

      <h2>What is collected</h2>
      <ul>
        <li>
          <strong>Your account:</strong> username, email address, and your password stored as a one-way hash, never in readable form. Also
          when you joined, when you last signed in, and whether you have confirmed your email address.
        </li>
        <li>
          <strong>What you post:</strong> your sub and dub ratings, notes and replies, votes on notes, reports that a title has an English dub,
          notes you report, and titles you request. Your username is shown next to your notes.
        </li>
        <li>
          <strong>Security records:</strong> the IP address and browser of each signed-in session, and of failed sign-in attempts, kept to
          protect accounts from abuse.
        </li>
        <li>
          <strong>Requests without an account:</strong> the title and details you type. Nothing else is stored with them.
        </li>
      </ul>

      <h2>Cookies</h2>
      <p>
        One cookie keeps you signed in. It is strictly necessary, set only when you sign in, and removed when you sign out. Your browser also
        remembers that you are signed in so the site does not check needlessly. No other cookies are used.
      </p>

      <h2>Other services</h2>
      <p>
        Cover art is normally fetched by AniRate&rsquo;s own server from the sites that host it (such as MyAnimeList, AniList and Kitsu)
        and then sent to you, so those sites do not see your visit. If that fails for a cover, your browser loads it from the hosting site
        directly, which shares your IP address with that site. Links to those sites, when you follow them, take you to services with their own privacy
        policies. Account emails, such as password resets, are sent through an email delivery provider, which receives your email address for
        that purpose only.
      </p>

      <h2>How long it is kept</h2>
      <ul>
        <li>Your account and what you post, until you delete your account.</li>
        <li>Sign-in sessions, for at most a week after they end; password-reset and confirmation links, until they are used or expire.</li>
        <li>Moderation records that admins write when they act on an account or a note, for as long as the site runs.</li>
      </ul>

      <h2>Your choices</h2>
      <p>
        You can delete your account at any time from <a className="link link--ruled" href="/my-ratings">My ratings</a>. That removes your
        account, ratings, notes, votes and reports at once; titles you requested stay in the queue without your name. To ask for a copy of your
        data, correct something, or raise any other privacy question, contact <ContactLine />.
      </p>

      <h2>Children</h2>
      <p>AniRate is not meant for children under 13, and does not knowingly hold their data.</p>

      <h2>Changes</h2>
      <p>If this policy changes in a way that matters, the date above changes and signed-in members are told on the site.</p>
    </LegalPage>
  );
}
