// Where the site lives, for absolute URLs in link previews, canonical links and the
// sitemap. Set NEXT_PUBLIC_SITE_URL to the public address in production.
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL?.trim() || 'http://localhost:3000').replace(/\/$/, '');
export const SITE_NAME = 'AniRate';
export const SITE_DESCRIPTION =
  'Sub or dub? AniRate scores the subtitled and dubbed release of every anime separately, rated by the otaku community.';
export const SHARE_IMAGE = `${SITE_URL}/opengraph-image`;
