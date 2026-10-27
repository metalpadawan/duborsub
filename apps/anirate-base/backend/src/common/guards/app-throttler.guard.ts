import { ExecutionContext, Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { timingSafeEqual } from 'crypto';

@Injectable()
export class AppThrottlerGuard extends ThrottlerGuard {
  // Track by the address Express resolved for the socket. X-Forwarded-For is only
  // honoured when TRUST_PROXY enables Express's own proxy handling, so clients
  // cannot dodge rate limits by sending a fake header.
  protected async getTracker(req: Record<string, any>) {
    return req.ip ?? req.socket?.remoteAddress ?? 'unknown';
  }

  // The website's own server renders every visitor's catalogue page, so to this API
  // it is a single client making most of the requests. It proves itself with the
  // shared INTERNAL_API_KEY and is not rate-limited; browsers never see the key.
  protected async shouldSkip(context: ExecutionContext) {
    const expected = process.env.INTERNAL_API_KEY;
    const presented = context.switchToHttp().getRequest().headers?.['x-internal-key'];
    if (!expected || typeof presented !== 'string') {
      return false;
    }

    const left = Buffer.from(presented);
    const right = Buffer.from(expected);
    return left.length === right.length && timingSafeEqual(left, right);
  }
}
