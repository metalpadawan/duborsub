// AuthService owns account creation, login, refresh rotation, and password reset.
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
import { Prisma, User } from '@prisma/client';
import { createHash, randomBytes, randomUUID } from 'crypto';
import { PrismaService } from '../common/prisma/prisma.service';
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
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly monitoring: MonitoringService,
  ) {}

  async register(dto: RegisterDto) {
    // Registration keeps uniqueness rules in one place so the controller stays thin.
    if ((await this.findUserByEmail(dto.email)) || (await this.findUserByUsername(dto.username))) {
      throw new ConflictException('Account already exists with those credentials');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

    try {
      const user = await this.prisma.user.create({
        data: { id: randomUUID(), username: dto.username, email: dto.email.toLowerCase(), passwordHash, role: 'user' },
      });
      return this.toPublicUser(user);
    } catch (error) {
      // A concurrent registration can take the email or username while this one
      // hashes; the unique indexes settle it.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Account already exists with those credentials');
      }
      throw error;
    }
  }

  async login(dto: LoginDto, ipAddress: string, userAgent: string) {
    // Login is where lockout rules, ban checks, and session creation all converge.
    // The password is always checked first so lock and ban status are only revealed
    // to someone who already knows the password.
    const user = await this.findUserByEmail(dto.email);
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
        // An expired lock starts the attempt counter over.
        const failedLoginAttempts = (user.lockedUntil ? 0 : user.failedLoginAttempts) + 1;
        lockedNow = failedLoginAttempts >= MAX_FAILED_ATTEMPTS;
        await this.prisma.user.update({
          where: { id: user.id },
          data: {
            failedLoginAttempts,
            lockedUntil: lockedNow ? new Date(now.getTime() + LOCKOUT_MINUTES * 60_000) : null,
          },
        });
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

    await this.prisma.user.update({
      where: { id: user.id },
      data: { failedLoginAttempts: 0, lockedUntil: null, lastLoginAt: new Date() },
    });

    const accessToken = await this.signAccessToken(user);
    const { rawToken: refreshToken } = await this.issueRefreshToken(this.prisma, user.id, ipAddress, userAgent);
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
    const stored = await this.prisma.refreshToken.findUnique({ where: { tokenHash } });

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

      await this.revokeActiveSessionsForUser(stored.userId);
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

    const user = await this.prisma.user.findUnique({ where: { id: stored.userId } });
    if (!user) {
      await this.prisma.refreshToken.update({ where: { id: stored.id }, data: { revokedAt: new Date() } });
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
      await this.revokeActiveSessionsForUser(user.id);
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
      await this.revokeActiveSessionsForUser(user.id);
      this.monitoring.recordSecurityEvent({
        type: 'auth.refresh.locked',
        severity: 'warning',
        message: 'A locked user attempted to refresh a session',
        userId: user.id,
        ipAddress: ipAddress || null,
      });
      throw new ForbiddenException('Account is temporarily locked');
    }

    // Rotation is a conditional update: if a concurrent refresh revoked this token
    // first, nothing is issued here and the client retries with the winner's cookie.
    const refreshToken = await this.prisma.$transaction(async (tx) => {
      const { rawToken, id: replacementId } = await this.issueRefreshToken(tx, user.id, ipAddress, userAgent);
      const { count } = await tx.refreshToken.updateMany({
        where: { id: stored.id, revokedAt: null },
        data: { revokedAt: new Date(), replacedByTokenId: replacementId },
      });
      if (count === 0) {
        throw new UnauthorizedException('Refresh token already rotated');
      }
      return rawToken;
    });
    const accessToken = await this.signAccessToken(user);
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
    const stored = await this.prisma.refreshToken.findUnique({ where: { tokenHash } });
    if (stored) {
      await this.prisma.refreshToken.update({ where: { id: stored.id }, data: { revokedAt: stored.revokedAt ?? new Date() } });
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
    const user = await this.findUserByEmail(dto.email);
    if (!user) {
      return { message: 'If that email exists, a reset link has been sent' };
    }

    const token = randomBytes(24).toString('hex');
    await this.prisma.passwordResetToken.create({
      data: {
        id: randomUUID(),
        userId: user.id,
        tokenHash: this.hashToken(token),
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    });

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
    const record = await this.prisma.passwordResetToken.findUnique({ where: { tokenHash } });

    if (!record || record.usedAt || record.expiresAt <= new Date()) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    const user = await this.prisma.user.findUnique({ where: { id: record.userId } });
    if (!user) {
      throw new BadRequestException('Invalid reset token');
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, 10);
    // Marking the token used is conditional, so the same link cannot be spent twice.
    await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.passwordResetToken.updateMany({
        where: { id: record.id, usedAt: null },
        data: { usedAt: new Date() },
      });
      if (count === 0) {
        throw new BadRequestException('Invalid or expired reset token');
      }
      await tx.user.update({ where: { id: user.id }, data: { passwordHash, failedLoginAttempts: 0, lockedUntil: null } });
      await tx.refreshToken.updateMany({ where: { userId: user.id, revokedAt: null }, data: { revokedAt: new Date() } });
    });
    this.monitoring.recordSecurityEvent({
      type: 'auth.password_reset.completed',
      severity: 'warning',
      message: 'A password was reset and all active sessions were revoked',
      userId: user.id,
    });

    return { message: 'Password updated successfully' };
  }

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return this.toPublicUser(user);
  }

  getRefreshTokenTtlMs() {
    return this.config.getOrThrow<number>('REFRESH_TOKEN_TTL_HOURS') * 60 * 60 * 1000;
  }

  private findUserByEmail(email: string) {
    // Emails are stored lower-cased, so lookups are case-insensitive.
    return this.prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  }

  private findUserByUsername(username: string) {
    return this.prisma.user.findFirst({ where: { username: { equals: username, mode: 'insensitive' } } });
  }

  private async signAccessToken(user: User) {
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

  private async issueRefreshToken(db: Prisma.TransactionClient, userId: string, ipAddress: string, userAgent: string) {
    // Only a hash is stored so a raw refresh token never lives in the database.
    const rawToken = randomBytes(40).toString('hex');
    const id = randomUUID();
    await db.refreshToken.create({
      data: {
        id,
        userId,
        tokenHash: this.hashToken(rawToken),
        ipAddress: ipAddress || null,
        userAgent: userAgent || null,
        expiresAt: new Date(Date.now() + this.getRefreshTokenTtlMs()),
      },
    });

    return { rawToken, id };
  }

  private hashToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  private async revokeActiveSessionsForUser(userId: string) {
    await this.prisma.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
  }

  private toPublicUser(user: User) {
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
