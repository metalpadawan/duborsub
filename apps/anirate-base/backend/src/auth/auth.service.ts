// AuthService owns account creation, login, refresh rotation, and password reset.
// It persists against the local file-backed datastore while keeping the same API
// shape that the frontend was already built against.
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes, randomUUID } from 'crypto';
import {
  DataService,
  PasswordResetTokenRecord,
  RefreshTokenRecord,
  UserRecord,
} from '../data/data.service';
import { MonitoringService } from '../monitoring/monitoring.service';
import { ForgotPasswordDto, LoginDto, RegisterDto, ResetPasswordDto } from './dto/auth.dto';

const LOCKOUT_MINUTES = 15;
const MAX_FAILED_ATTEMPTS = 5;
// A rotated refresh token presented again within this window is treated as a
// concurrent refresh (two tabs, a retried request), not as theft.
export const ROTATION_GRACE_MS = 10_000;
// Unknown emails are compared against this hash so every login costs one bcrypt
// comparison and response timing does not reveal which accounts exist.
const DUMMY_PASSWORD_HASH = bcrypt.hashSync(randomBytes(16).toString('hex'), 10);

@Injectable()
export class AuthService {
  constructor(
    private readonly data: DataService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly monitoring: MonitoringService,
  ) {}

  async register(dto: RegisterDto) {
    // Registration keeps uniqueness rules in one place so the controller stays thin.
    const emailExists = this.data.findUserByEmail(dto.email);
    const usernameExists = this.data.findUserByUsername(dto.username);

    if (emailExists || usernameExists) {
      throw new ConflictException('Account already exists with those credentials');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

    // Re-check after the await: a concurrent request may have registered the same
    // account while hashing. The check and push below run without yielding.
    if (this.data.findUserByEmail(dto.email) || this.data.findUserByUsername(dto.username)) {
      throw new ConflictException('Account already exists with those credentials');
    }

    const now = new Date();
    const user: UserRecord = {
      id: randomUUID(),
      username: dto.username,
      email: dto.email.toLowerCase(),
      passwordHash,
      role: 'user',
      isBanned: false,
      banReason: null,
      bannedUntil: null,
      failedLoginAttempts: 0,
      lockedUntil: null,
      lastLoginAt: null,
      createdAt: now,
      updatedAt: now,
    };

    this.data.users.push(user);
    this.data.save();

    return this.toPublicUser(user);
  }

  async login(dto: LoginDto, ipAddress: string, userAgent: string) {
    // Login is where lockout rules, ban checks, and session creation all converge.
    // The password is always checked first so lock and ban status are only revealed
    // to someone who already knows the password.
    const user = this.data.findUserByEmail(dto.email);
    const passwordMatches = await bcrypt.compare(dto.password, user?.passwordHash ?? DUMMY_PASSWORD_HASH);

    if (!user) {
      this.monitoring.recordSecurityEvent({
        type: 'auth.login.failed',
        severity: 'warning',
        message: 'Failed login attempt for an unknown account',
        ipAddress: ipAddress || null,
        metadata: {
          email: dto.email,
        },
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    const now = new Date();
    const isLocked = Boolean(user.lockedUntil && user.lockedUntil > now);

    if (!passwordMatches) {
      let lockedNow = false;
      if (!isLocked) {
        if (user.lockedUntil) {
          // The previous lock has expired, so the attempt counter starts over.
          user.failedLoginAttempts = 0;
          user.lockedUntil = null;
        }

        user.failedLoginAttempts += 1;
        user.updatedAt = now;
        if (user.failedLoginAttempts >= MAX_FAILED_ATTEMPTS) {
          user.lockedUntil = new Date(now.getTime() + LOCKOUT_MINUTES * 60_000);
          lockedNow = true;
        }
        this.data.save();
      }

      this.monitoring.recordSecurityEvent({
        type: lockedNow ? 'auth.login.locked' : 'auth.login.failed',
        severity: 'warning',
        message: lockedNow
          ? 'An account was locked after repeated failed logins'
          : 'A user supplied invalid credentials',
        userId: user.id,
        ipAddress: ipAddress || null,
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    if (isLocked) {
      this.monitoring.recordSecurityEvent({
        type: 'auth.login.locked',
        severity: 'warning',
        message: 'A locked account attempted to sign in',
        userId: user.id,
        ipAddress: ipAddress || null,
      });
      throw new ForbiddenException('Account is temporarily locked');
    }

    if (user.isBanned && (!user.bannedUntil || user.bannedUntil > now)) {
      this.monitoring.recordSecurityEvent({
        type: 'auth.login.banned',
        severity: 'warning',
        message: 'A banned account attempted to sign in',
        userId: user.id,
        ipAddress: ipAddress || null,
      });
      throw new ForbiddenException('Account has been suspended');
    }

    user.failedLoginAttempts = 0;
    user.lockedUntil = null;
    user.lastLoginAt = new Date();
    user.updatedAt = new Date();

    const accessToken = await this.signAccessToken(user);
    const { rawToken: refreshToken } = this.issueRefreshToken(user.id, ipAddress, userAgent);
    this.data.save();
    this.monitoring.recordSecurityEvent({
      type: 'auth.login.succeeded',
      severity: 'info',
      message: 'A user signed in successfully',
      userId: user.id,
      ipAddress: ipAddress || null,
    });

    return {
      user: this.toPublicUser(user),
      accessToken,
      refreshToken,
    };
  }

  async refresh(rawToken: string, ipAddress: string, userAgent: string) {
    // Refresh tokens are rotated every time to reduce the value of a leaked token.
    if (!rawToken) {
      this.monitoring.recordSecurityEvent({
        type: 'auth.refresh.missing',
        severity: 'warning',
        message: 'A refresh request arrived without a refresh token',
        ipAddress: ipAddress || null,
      });
      throw new UnauthorizedException('No refresh token');
    }

    const tokenHash = this.hashToken(rawToken);
    const stored = this.data.refreshTokens.find((entry) => entry.tokenHash === tokenHash) ?? null;

    if (stored?.revokedAt) {
      const recentlyRotated =
        Boolean(stored.replacedByTokenId) && Date.now() - stored.revokedAt.getTime() < ROTATION_GRACE_MS;

      if (recentlyRotated) {
        // A concurrent refresh already rotated this token. Reject this request without
        // revoking anything; the client retries with the cookie the winner received.
        this.monitoring.recordSecurityEvent({
          type: 'auth.refresh.concurrent',
          severity: 'info',
          message: 'A just-rotated refresh token was presented again inside the grace window',
          userId: stored.userId,
          ipAddress: ipAddress || null,
        });
        throw new UnauthorizedException('Refresh token already rotated');
      }

      this.revokeActiveSessionsForUser(stored.userId);
      this.data.save();
      this.monitoring.recordSecurityEvent({
        type: 'auth.refresh.reuse_detected',
        severity: 'critical',
        message: 'A revoked refresh token was presented again',
        userId: stored.userId,
        ipAddress: ipAddress || null,
      });
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    if (!stored || stored.expiresAt <= new Date()) {
      this.monitoring.recordSecurityEvent({
        type: 'auth.refresh.failed',
        severity: 'warning',
        message: 'An invalid or expired refresh token was rejected',
        ipAddress: ipAddress || null,
      });
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const user = this.data.findUserById(stored.userId);
    if (!user) {
      stored.revokedAt = new Date();
      this.data.save();
      this.monitoring.recordSecurityEvent({
        type: 'auth.refresh.orphaned',
        severity: 'warning',
        message: 'A refresh token referenced a missing user',
        ipAddress: ipAddress || null,
      });
      throw new UnauthorizedException('User not found');
    }

    if (stored.userAgent && userAgent && stored.userAgent !== userAgent) {
      // User agents change on every browser update, so a mismatch is recorded for
      // review instead of ending the session.
      this.monitoring.recordSecurityEvent({
        type: 'auth.refresh.user_agent_mismatch',
        severity: 'warning',
        message: 'A refresh token was presented from a different user agent',
        userId: user.id,
        ipAddress: ipAddress || null,
        metadata: {
          previousUserAgent: stored.userAgent,
          currentUserAgent: userAgent,
        },
      });
    }

    if (user.isBanned && (!user.bannedUntil || user.bannedUntil > new Date())) {
      this.revokeActiveSessionsForUser(user.id);
      this.data.save();
      this.monitoring.recordSecurityEvent({
        type: 'auth.refresh.banned',
        severity: 'warning',
        message: 'A banned user attempted to refresh a session',
        userId: user.id,
        ipAddress: ipAddress || null,
      });
      throw new ForbiddenException('Account has been suspended');
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      this.revokeActiveSessionsForUser(user.id);
      this.data.save();
      this.monitoring.recordSecurityEvent({
        type: 'auth.refresh.locked',
        severity: 'warning',
        message: 'A locked user attempted to refresh a session',
        userId: user.id,
        ipAddress: ipAddress || null,
      });
      throw new ForbiddenException('Account is temporarily locked');
    }

    const accessToken = await this.signAccessToken(user);
    const { rawToken: refreshToken, id: replacementId } = this.issueRefreshToken(user.id, ipAddress, userAgent);
    stored.revokedAt = new Date();
    stored.replacedByTokenId = replacementId;
    this.data.save();
    this.monitoring.recordSecurityEvent({
      type: 'auth.refresh.succeeded',
      severity: 'info',
      message: 'A refresh token was rotated successfully',
      userId: user.id,
      ipAddress: ipAddress || null,
    });

    return { accessToken, refreshToken };
  }

  async logout(rawToken: string | undefined) {
    // Logout is intentionally tolerant because clients may already have lost the cookie.
    if (!rawToken) {
      return;
    }

    const tokenHash = this.hashToken(rawToken);
    const stored = this.data.refreshTokens.find((entry) => entry.tokenHash === tokenHash);
    if (stored) {
      stored.revokedAt = new Date();
      this.data.save();
      this.monitoring.recordSecurityEvent({
        type: 'auth.logout',
        severity: 'info',
        message: 'A refresh session was explicitly logged out',
        userId: stored.userId,
      });
    }
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    // The response text stays generic so this endpoint cannot be used to enumerate accounts.
    const user = this.data.findUserByEmail(dto.email);
    if (!user) {
      return { message: 'If that email exists, a reset link has been sent' };
    }

    const token = randomBytes(24).toString('hex');
    const record: PasswordResetTokenRecord = {
      id: randomUUID(),
      userId: user.id,
      tokenHash: this.hashToken(token),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      usedAt: null,
      createdAt: new Date(),
    };

    this.data.passwordResetTokens.push(record);
    this.data.save();

    const response: Record<string, unknown> = {
      message: 'If that email exists, a reset link has been sent',
    };

    // Returning the token is a local-testing shortcut until SMTP is wired up. It is
    // opt-in, and environment validation refuses to enable it in production.
    if (this.config.get<boolean>('EXPOSE_RESET_TOKEN', false) === true) {
      response.debugToken = token;
    }

    this.monitoring.recordSecurityEvent({
      type: 'auth.password_reset.requested',
      severity: 'info',
      message: 'A password reset request was accepted',
      userId: user.id,
    });

    return response;
  }

  async resetPassword(dto: ResetPasswordDto) {
    // Password reset also revokes active refresh sessions to force a clean re-login.
    const tokenHash = this.hashToken(dto.token);
    const record = this.data.passwordResetTokens.find((entry) => entry.tokenHash === tokenHash) ?? null;

    if (!record || record.usedAt || record.expiresAt <= new Date()) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    const user = this.data.findUserById(record.userId);
    if (!user) {
      throw new BadRequestException('Invalid reset token');
    }

    user.passwordHash = await bcrypt.hash(dto.newPassword, 10);
    user.failedLoginAttempts = 0;
    user.lockedUntil = null;
    user.updatedAt = new Date();
    record.usedAt = new Date();

    this.revokeActiveSessionsForUser(user.id);
    this.data.save();
    this.monitoring.recordSecurityEvent({
      type: 'auth.password_reset.completed',
      severity: 'warning',
      message: 'A password was reset and all active sessions were revoked',
      userId: user.id,
    });

    return { message: 'Password updated successfully' };
  }

  getMe(userId: string) {
    const user = this.data.findUserById(userId);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return this.toPublicUser(user);
  }

  getRefreshTokenTtlMs() {
    return this.config.getOrThrow<number>('REFRESH_TOKEN_TTL_HOURS') * 60 * 60 * 1000;
  }

  private async signAccessToken(user: UserRecord) {
    // Access tokens stay short-lived and simple; refresh rotation handles continuity.
    return this.jwt.signAsync(
      { sub: user.id, role: user.role },
      {
        expiresIn: `${this.config.getOrThrow<number>('ACCESS_TOKEN_TTL_MINUTES')}m`,
        issuer: this.config.getOrThrow<string>('JWT_ISSUER'),
        audience: this.config.getOrThrow<string>('JWT_AUDIENCE'),
      },
    );
  }

  private issueRefreshToken(userId: string, ipAddress: string, userAgent: string) {
    // Only a hash is stored so a raw refresh token never lives in application state.
    const rawToken = randomBytes(40).toString('hex');
    const record: RefreshTokenRecord = {
      id: randomUUID(),
      userId,
      tokenHash: this.hashToken(rawToken),
      ipAddress: ipAddress || null,
      userAgent: userAgent || null,
      expiresAt: new Date(Date.now() + this.getRefreshTokenTtlMs()),
      revokedAt: null,
      replacedByTokenId: null,
      createdAt: new Date(),
    };

    this.data.refreshTokens.push(record);

    return { rawToken, id: record.id };
  }

  private hashToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  private revokeActiveSessionsForUser(userId: string) {
    this.data.refreshTokens
      .filter((token) => token.userId === userId && !token.revokedAt)
      .forEach((token) => {
        token.revokedAt = new Date();
      });
  }

  private toPublicUser(user: UserRecord) {
    // Controllers only return safe fields that the frontend actually needs.
    return {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
    };
  }
}
