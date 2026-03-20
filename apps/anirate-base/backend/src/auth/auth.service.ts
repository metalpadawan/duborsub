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
import { ForgotPasswordDto, LoginDto, RegisterDto, ResetPasswordDto } from './dto/auth.dto';

const ACCESS_TOKEN_MINUTES = 15;
const REFRESH_TOKEN_DAYS = 7;
const LOCKOUT_MINUTES = 15;
const MAX_FAILED_ATTEMPTS = 5;

@Injectable()
export class AuthService {
  constructor(
    private readonly data: DataService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async register(dto: RegisterDto) {
    // Registration keeps uniqueness rules in one place so the controller stays thin.
    const emailExists = this.data.findUserByEmail(dto.email);
    const usernameExists = this.data.findUserByUsername(dto.username);

    if (emailExists || usernameExists) {
      throw new ConflictException('Account already exists with those credentials');
    }

    const now = new Date();
    const user: UserRecord = {
      id: randomUUID(),
      username: dto.username,
      email: dto.email.toLowerCase(),
      passwordHash: await bcrypt.hash(dto.password, 10),
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
    const user = this.data.findUserByEmail(dto.email);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new ForbiddenException('Account is temporarily locked');
    }

    if (user.isBanned && (!user.bannedUntil || user.bannedUntil > new Date())) {
      throw new ForbiddenException('Account has been suspended');
    }

    const passwordMatches = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordMatches) {
      user.failedLoginAttempts += 1;
      user.updatedAt = new Date();
      if (user.failedLoginAttempts >= MAX_FAILED_ATTEMPTS) {
        user.lockedUntil = new Date(Date.now() + LOCKOUT_MINUTES * 60_000);
      }
      this.data.save();
      throw new UnauthorizedException('Invalid credentials');
    }

    user.failedLoginAttempts = 0;
    user.lockedUntil = null;
    user.lastLoginAt = new Date();
    user.updatedAt = new Date();

    const accessToken = await this.signAccessToken(user);
    const refreshToken = this.issueRefreshToken(user.id, ipAddress, userAgent);
    this.data.save();

    return {
      user: this.toPublicUser(user),
      accessToken,
      refreshToken,
    };
  }

  async refresh(rawToken: string, ipAddress: string, userAgent: string) {
    // Refresh tokens are rotated every time to reduce the value of a leaked token.
    if (!rawToken) {
      throw new UnauthorizedException('No refresh token');
    }

    const tokenHash = this.hashToken(rawToken);
    const stored = this.data.refreshTokens.find((entry) => entry.tokenHash === tokenHash) ?? null;

    if (!stored || stored.revokedAt || stored.expiresAt <= new Date()) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const user = this.data.findUserById(stored.userId);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    stored.revokedAt = new Date();
    const accessToken = await this.signAccessToken(user);
    const refreshToken = this.issueRefreshToken(user.id, ipAddress, userAgent);
    this.data.save();

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

    if (this.config.get('NODE_ENV', 'development') !== 'production') {
      response.debugToken = token;
    }

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

    this.data.refreshTokens
      .filter((token) => token.userId === user.id && !token.revokedAt)
      .forEach((token) => {
        token.revokedAt = new Date();
      });
    this.data.save();

    return { message: 'Password updated successfully' };
  }

  getMe(userId: string) {
    const user = this.data.findUserById(userId);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return this.toPublicUser(user);
  }

  private async signAccessToken(user: UserRecord) {
    // Access tokens stay short-lived and simple; refresh rotation handles continuity.
    return this.jwt.signAsync(
      { sub: user.id, role: user.role },
      { expiresIn: `${ACCESS_TOKEN_MINUTES}m` },
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
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000),
      revokedAt: null,
      createdAt: new Date(),
    };

    this.data.refreshTokens.push(record);

    return rawToken;
  }

  private hashToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
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
