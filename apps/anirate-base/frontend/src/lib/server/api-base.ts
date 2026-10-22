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
