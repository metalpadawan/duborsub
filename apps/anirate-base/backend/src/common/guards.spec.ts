import { afterEach, describe, expect, it } from '@jest/globals';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { VerifiedEmailGuard } from '../auth/guards/verified-email.guard';
import { AppThrottlerGuard } from './guards/app-throttler.guard';

function contextWith(request: object) {
  return { switchToHttp: () => ({ getRequest: () => request }) } as unknown as ExecutionContext;
}

describe('VerifiedEmailGuard', () => {
  const guard = new VerifiedEmailGuard();

  it('lets a member with a confirmed email through', () => {
    expect(guard.canActivate(contextWith({ user: { emailVerified: true } }))).toBe(true);
  });

  it('stops a member who has not confirmed', () => {
    expect(() => guard.canActivate(contextWith({ user: { emailVerified: false } }))).toThrow(ForbiddenException);
  });
});

describe('AppThrottlerGuard', () => {
  const guard = Object.create(AppThrottlerGuard.prototype) as AppThrottlerGuard;
  const shouldSkip = (guard as unknown as { shouldSkip: (context: ExecutionContext) => Promise<boolean> }).shouldSkip.bind(guard);
  const key = 'k'.repeat(48);

  afterEach(() => {
    delete process.env.INTERNAL_API_KEY;
  });

  it("exempts the website's own server when it presents the shared key", async () => {
    process.env.INTERNAL_API_KEY = key;

    await expect(shouldSkip(contextWith({ headers: { 'x-internal-key': key } }))).resolves.toBe(true);
  });

  it('limits everyone else, including a wrong key or no key configured', async () => {
    process.env.INTERNAL_API_KEY = key;
    await expect(shouldSkip(contextWith({ headers: { 'x-internal-key': 'guess' } }))).resolves.toBe(false);
    await expect(shouldSkip(contextWith({ headers: {} }))).resolves.toBe(false);

    delete process.env.INTERNAL_API_KEY;
    await expect(shouldSkip(contextWith({ headers: { 'x-internal-key': key } }))).resolves.toBe(false);
  });
});
