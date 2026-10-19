import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

@Injectable()
export class AppThrottlerGuard extends ThrottlerGuard {
  // Track by the address Express resolved for the socket. X-Forwarded-For is only
  // honoured when TRUST_PROXY enables Express's own proxy handling, so clients
  // cannot dodge rate limits by sending a fake header.
  protected async getTracker(req: Record<string, any>) {
    return req.ip ?? req.socket?.remoteAddress ?? 'unknown';
  }
}
