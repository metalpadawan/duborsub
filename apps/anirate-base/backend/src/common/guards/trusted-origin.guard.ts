import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

@Injectable()
export class TrustedOriginGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<Request>();

    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) {
      return true;
    }

    const candidate = this.extractOriginCandidate(request);
    if (!candidate) {
      return true;
    }

    if (candidate === 'null') {
      throw new ForbiddenException('Untrusted request origin');
    }

    const expectedOrigin = new URL(this.config.getOrThrow<string>('FRONTEND_URL')).origin;

    try {
      const actualOrigin = new URL(candidate).origin;
      if (actualOrigin !== expectedOrigin) {
        throw new ForbiddenException('Untrusted request origin');
      }
    } catch (error) {
      if (error instanceof ForbiddenException) {
        throw error;
      }

      throw new ForbiddenException('Untrusted request origin');
    }

    return true;
  }

  private extractOriginCandidate(request: Request) {
    const origin = request.headers.origin;
    if (typeof origin === 'string' && origin.length > 0) {
      return origin;
    }

    const referer = request.headers.referer;
    if (typeof referer === 'string' && referer.length > 0) {
      return referer;
    }

    return null;
  }
}
