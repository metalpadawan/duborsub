import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { resetAlertLimits, sendErrorAlert } from './alert-webhook';

describe('sendErrorAlert', () => {
  const fetchMock = jest.fn(async () => new Response(null, { status: 204 }));

  beforeEach(() => {
    resetAlertLimits();
    fetchMock.mockClear();
    global.fetch = fetchMock as unknown as typeof fetch;
    process.env.ALERT_WEBHOOK_URL = 'https://hooks.example/alert';
  });

  afterEach(() => {
    delete process.env.ALERT_WEBHOOK_URL;
  });

  it('posts the error for Discord and Slack alike', () => {
    expect(sendErrorAlert('GET /anime boom', 'AniRate server error')).toBe(true);

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://hooks.example/alert');
    expect(JSON.parse(String(init.body))).toEqual({ content: 'AniRate server error', text: 'AniRate server error' });
  });

  it('sends the same error once every ten minutes, and at most twenty an hour', () => {
    const start = 1_000_000;
    expect(sendErrorAlert('same', 'x', start)).toBe(true);
    expect(sendErrorAlert('same', 'x', start + 60_000)).toBe(false);
    expect(sendErrorAlert('same', 'x', start + 11 * 60_000)).toBe(true);

    for (let index = 0; index < 30; index += 1) sendErrorAlert(`error-${index}`, 'x', start + 12 * 60_000);
    expect(fetchMock).toHaveBeenCalledTimes(20);
  });

  it('does nothing when no webhook is configured', () => {
    delete process.env.ALERT_WEBHOOK_URL;

    expect(sendErrorAlert('any', 'x')).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
