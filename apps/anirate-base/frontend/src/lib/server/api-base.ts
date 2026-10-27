// Where server-side rendering reaches the API. API_URL lets the server use an
// internal address; the browser-facing URL is the fallback, then the local backend
// during development.
export function resolveServerApiUrl() {
  const configured = process.env.API_URL?.trim() || process.env.NEXT_PUBLIC_API_URL?.trim();
  if (configured) {
    return configured.replace(/\/$/, '');
  }

  return process.env.NODE_ENV === 'production' ? null : 'http://localhost:4000/api/v1';
}

// The site's own server makes the API requests for every visitor's page, so to the
// API it is one very busy client. This shared key (INTERNAL_API_KEY, the same on
// both servers, never sent to browsers) exempts those requests from the per-client
// rate limit, which would otherwise throttle the whole site.
export function internalApiHeaders(): Record<string, string> {
  const key = process.env.INTERNAL_API_KEY?.trim();
  return key ? { 'X-Internal-Key': key } : {};
}
