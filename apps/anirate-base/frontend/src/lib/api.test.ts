import { afterEach, describe, expect, it, vi } from 'vitest';
import { api, refreshAccessToken, tokenStore } from './api';

function unauthorized() {
  return Object.assign(new Error('Unauthorized'), { response: { status: 401 } });
}

describe('refreshAccessToken', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    tokenStore.clear();
  });

  it('retries once when another tab rotated the refresh cookie first', async () => {
    const post = vi
      .spyOn(api, 'post')
      .mockRejectedValueOnce(unauthorized())
      .mockResolvedValueOnce({ data: { accessToken: 'fresh-token' } });

    await expect(refreshAccessToken()).resolves.toBe('fresh-token');
    expect(post).toHaveBeenCalledTimes(2);
    expect(tokenStore.get()).toBe('fresh-token');
  });

  it('shares one in-flight refresh between concurrent callers', async () => {
    const post = vi.spyOn(api, 'post').mockResolvedValue({ data: { accessToken: 'shared-token' } });

    const [first, second] = await Promise.all([refreshAccessToken(), refreshAccessToken()]);

    expect(first).toBe('shared-token');
    expect(second).toBe('shared-token');
    expect(post).toHaveBeenCalledTimes(1);
  });

  it('clears the access token when the session really is gone', async () => {
    tokenStore.set('stale-token');
    vi.spyOn(api, 'post').mockRejectedValue(unauthorized());

    await expect(refreshAccessToken()).rejects.toThrow('Unauthorized');
    expect(tokenStore.get()).toBeNull();
  });
});
