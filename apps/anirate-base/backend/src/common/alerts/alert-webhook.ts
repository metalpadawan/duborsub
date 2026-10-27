// Posts unexpected server errors to a chat webhook (ALERT_WEBHOOK_URL), so a broken
// deploy is noticed without watching logs. Discord reads "content" and Slack reads
// "text", so both are sent. A crash loop is limited to one alert per error every ten
// minutes and twenty an hour overall; anything beyond that is only logged.
const PER_ERROR_MS = 10 * 60_000;
const HOURLY_LIMIT = 20;

const lastSent = new Map<string, number>();
let windowStart = 0;
let sentThisHour = 0;

export function alertsEnabled() {
  return Boolean(process.env.ALERT_WEBHOOK_URL?.trim());
}

/** Fire-and-forget: an alert failing must never affect the request that failed. */
export function sendErrorAlert(key: string, text: string, now = Date.now()) {
  const url = process.env.ALERT_WEBHOOK_URL?.trim();
  if (!url) return false;

  if (now - windowStart > 60 * 60_000) {
    windowStart = now;
    sentThisHour = 0;
  }
  if (sentThisHour >= HOURLY_LIMIT || now - (lastSent.get(key) ?? 0) < PER_ERROR_MS) {
    return false;
  }

  lastSent.set(key, now);
  sentThisHour += 1;
  // Chat messages are short; the full stack trace stays in the server log.
  const message = text.length > 1800 ? `${text.slice(0, 1800)}…` : text;
  void fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content: message, text: message }),
    signal: AbortSignal.timeout(5_000),
  }).catch(() => undefined);
  return true;
}

/** For tests: forget what has been sent. */
export function resetAlertLimits() {
  lastSent.clear();
  windowStart = 0;
  sentThisHour = 0;
}
