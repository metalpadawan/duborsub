import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

@Injectable()
export class AppThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, any>) {
    if (req.user?.id) {
      return `user:${String(req.user.id)}`;
    }

    const forwardedFor = req.headers?.['x-forwarded-for'];
    if (typeof forwardedFor === 'string' && forwardedFor.length > 0) {
      return forwardedFor.split(',')[0].trim();
    }

    return req.ip ?? req.ips?.[0] ?? req.socket?.remoteAddress ?? 'unknown';
  }
}
