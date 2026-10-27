// Writes that shape the scores (ratings, notes, votes, dub and note reports) need a
// confirmed email address, which keeps one person from voting through a stack of
// throwaway accounts. Used after JwtAuthGuard, which puts the user on the request.
import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';

@Injectable()
export class VerifiedEmailGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    const user = context.switchToHttp().getRequest().user as { emailVerified?: boolean } | undefined;
    if (!user?.emailVerified) {
      throw new ForbiddenException('Confirm your email address first');
    }

    return true;
  }
}
