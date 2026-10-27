// Like JwtAuthGuard, but a request without a valid token goes through anonymously
// (req.user is null) instead of being refused.
import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  handleRequest<TUser>(_error: unknown, user: TUser | false) {
    return (user || null) as TUser;
  }
}
