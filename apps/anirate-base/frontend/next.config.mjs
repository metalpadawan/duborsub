import path from 'node:path';
import { fileURLToPath } from 'node:url';
import imageHosts from './src/lib/image-hosts.json' with { type: 'json' };

const appRoot = path.dirname(fileURLToPath(import.meta.url));
const isDev = process.env.NODE_ENV !== 'production';

// The browser talks to the API directly (sign-in, ratings, notes), so its origin is
// the one place besides this site that scripts may connect to.
function apiOrigin() {
  const configured = process.env.NEXT_PUBLIC_API_URL?.trim() || (isDev ? 'http://localhost:4000/api/v1' : '');
  try {
    return configured ? new URL(configured).origin : '';
  } catch {
    return '';
  }
}

// Inline scripts stay allowed: Next inlines its hydration data, and the zero-JS
// catalogue pages carry one inline shortcut script. Nonces would force every page
// to render per request and lose static generation. The policy still blocks
// scripts from other origins, plugins, framing and form hijacking.
// Covers come from many metadata CDNs (MyAnimeList, AniList, Kitsu, AniDB, ...),
// so images may load from any HTTPS origin.
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https:",
  "font-src 'self'",
  `connect-src 'self' ${apiOrigin()}${isDev ? ' ws: wss:' : ''}`.trim(),
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(isDev ? [] : ['upgrade-insecure-requests']),
].join('; ');

const nextConfig = {
  // A self-contained server bundle for the Docker image (see Dockerfile).
  output: 'standalone',
  turbopack: {
    root: appRoot,
  },
  // Covers are resized and re-encoded by Next's optimizer, from these hosts only.
  images: {
    remotePatterns: imageHosts.map((hostname) => ({ protocol: 'https', hostname })),
    // WebP only: AVIF is a little smaller but takes seconds to encode a cover the
    // first time it is shown, and most covers are shown for the first time.
    formats: ['image/webp'],
    minimumCacheTTL: 60 * 60 * 24 * 30,
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'Content-Security-Policy', value: contentSecurityPolicy },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
};

export default nextConfig;
