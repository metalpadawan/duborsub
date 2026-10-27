import { describe, expect, it } from '@jest/globals';
import { BadRequestException } from '@nestjs/common';
import { validateEnvironment } from '../config/environment.validation';
import { AppThrottlerGuard } from './guards/app-throttler.guard';
import { ParseResourceIdPipe } from './pipes/parse-resource-id.pipe';

const BASE_ENV = {
  JWT_SECRET: 'x'.repeat(48),
  DATABASE_URL: 'postgresql://localhost:5432/anirate',
};

describe('ParseResourceIdPipe', () => {
  const pipe = new ParseResourceIdPipe();

  it.each(['anilist-21', 'seed-user-demo', 'ff0c8c69-b21f-4dfa-a22b-1bfba63c20e3'])('accepts %s', (id) => {
    expect(pipe.transform(id)).toBe(id);
  });

  it.each(['', '../etc', 'has space', '-leading-dash', 'a'.repeat(65)])('rejects %p', (id) => {
    expect(() => pipe.transform(id)).toThrow(BadRequestException);
  });
});

describe('AppThrottlerGuard', () => {
  it('tracks clients by the resolved IP and ignores a spoofed X-Forwarded-For header', async () => {
    const guard = Object.create(AppThrottlerGuard.prototype) as AppThrottlerGuard;
    const getTracker = (guard as unknown as { getTracker: (req: object) => Promise<string> }).getTracker.bind(guard);

    const tracker = await getTracker({
      ip: '203.0.113.7',
      headers: { 'x-forwarded-for': '1.2.3.4' },
    });

    expect(tracker).toBe('203.0.113.7');
  });
});

describe('validateEnvironment', () => {
  it('leaves reset-token exposure off by default', () => {
    expect(validateEnvironment({ ...BASE_ENV }).EXPOSE_RESET_TOKEN).toBe(false);
  });

  it('treats settings left blank as not set, as the production compose file passes them', () => {
    const parsed = validateEnvironment({
      ...BASE_ENV,
      NODE_ENV: 'production',
      FRONTEND_URL: 'https://anirate.example',
      SMTP_HOST: '',
      SMTP_USER: '',
      SEED_ADMIN_EMAIL: '',
      ALERT_WEBHOOK_URL: '  ',
    });

    expect(parsed).toMatchObject({ NODE_ENV: 'production' });
    expect(parsed.SMTP_HOST).toBeUndefined();
    expect(parsed.SEED_ADMIN_EMAIL).toBeUndefined();
  });

  it('still rejects a filled-in setting that is wrong', () => {
    expect(() => validateEnvironment({ ...BASE_ENV, ALERT_WEBHOOK_URL: 'http://hooks.example/alert' })).toThrow('ALERT_WEBHOOK_URL must use HTTPS');
  });

  it('refuses to expose reset tokens in production', () => {
    expect(() =>
      validateEnvironment({
        ...BASE_ENV,
        NODE_ENV: 'production',
        FRONTEND_URL: 'https://anirate.example',
        EXPOSE_RESET_TOKEN: 'true',
      }),
    ).toThrow('EXPOSE_RESET_TOKEN must not be enabled in production');
  });
});
