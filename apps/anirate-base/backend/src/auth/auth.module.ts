// ============================================================
// AUTH MODULE — NestJS
// Covers: register, login, logout, refresh, password reset
// Security: bcrypt, JWT access + httpOnly refresh cookie,
//           brute-force lockout, token rotation
// ============================================================

// ── auth.module.ts ───────────────────────────────────────────
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';

// Export as a separate module file — shown inline here for brevity

// ── auth.dto.ts ──────────────────────────────────────────────
import {
  IsEmail, IsString, MinLength, MaxLength, Matches,
} from 'class-validator';

export class RegisterDto {
  @IsString()
  @MinLength(3)
  @MaxLength(30)
  @Matches(/^[a-zA-Z0-9_-]+$/, {
    message: 'Username may only contain letters, numbers, underscores, and hyphens',
  })
  username: string;

  @IsEmail()
  @MaxLength(254)
  email: string;

  @IsString()
  @MinLength(8)
  @MaxLength(72) // bcrypt hard limit
  @Matches(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&_\-#])[A-Za-z\d@$!%*?&_\-#]+$/,
    { message: 'Password must include uppercase, lowercase, number, and special character' },
  )
  password: string;
}

export class LoginDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(1)
  password: string;
}

export class ForgotPasswordDto {
  @IsEmail()
  email: string;
}

export class ResetPasswordDto {
  @IsString()
  token: string;

  @IsString()
  @MinLength(8)
  @MaxLength(72)
  @Matches(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&_\-#])[A-Za-z\d@$!%*?&_\-#]+$/,
    { message: 'Password must include uppercase, lowercase, number, and special character' },
  )
  newPassword: string;
}

// ── auth.service.ts ──────────────────────────────────────────
import {
  Injectable, UnauthorizedException, ConflictException,
  BadRequestException, ForbiddenException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { PrismaService } from '../common/prisma/prisma.service';

const BCRYPT_ROUNDS = 12;
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;
const REFRESH_TOKEN_DAYS = 7;
const ACCESS_TOKEN_MINUTES = 15;
const RESET_TOKEN_HOURS = 1;

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
  ) {}

  // ── Register ───────────────────────────────────────────────
  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findFirst({
      where: { OR: [{ email: dto.email }, { username: dto.username }] },
    });
    if (existing) {
      // Don't reveal which field conflicts
      throw new ConflictException('Account already exists with those credentials');
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

    const user = await this.prisma.user.create({
      data: { username: dto.username, email: dto.email, passwordHash },
      select: { id: true, username: true, email: true, role: true, createdAt: true },
    });

    return user;
  }

  // ── Login ──────────────────────────────────────────────────
  async login(dto: LoginDto, ip: string, userAgent: string) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });

    // Always hash to prevent timing attacks even when user not found
    const dummyHash = '$2b$12$invalidhashfortimingprotection000000000000000000000000';

    if (!user) {
      await bcrypt.compare(dto.password, dummyHash);
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check lockout
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const remaining = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60_000);
      throw new ForbiddenException(`Account locked. Try again in ${remaining} minutes`);
    }

    // Check ban
    if (user.isBanned) {
      if (!user.bannedUntil || user.bannedUntil > new Date()) {
        throw new ForbiddenException('Account has been suspended');
      }
    }

    const valid = await bcrypt.compare(dto.password, user.passwordHash);

    if (!valid) {
      const newFailCount = user.failedLoginAttempts + 1;
      const shouldLock = newFailCount >= MAX_FAILED_ATTEMPTS;

      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: newFailCount,
          lockedUntil: shouldLock
            ? new Date(Date.now() + LOCKOUT_MINUTES * 60_000)
            : undefined,
        },
      });

      throw new UnauthorizedException('Invalid credentials');
    }

    // Reset failed attempts on success
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: 0,
        lockedUntil: null,
        lastLoginAt: new Date(),
      },
    });

    const tokens = await this.generateTokens(user.id, user.role, ip, userAgent);
    return { user: { id: user.id, username: user.username, role: user.role }, ...tokens };
  }

  // ── Refresh ────────────────────────────────────────────────
  async refresh(rawToken: string, ip: string, userAgent: string) {
    const tokenHash = this.hashToken(rawToken);
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: { select: { id: true, role: true, isBanned: true } } },
    });

    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      // Token reuse detected — revoke all tokens for that user if we found the record
      if (stored) {
        await this.prisma.refreshToken.updateMany({
          where: { userId: stored.userId },
          data: { revokedAt: new Date() },
        });
      }
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    if (stored.user.isBanned) throw new ForbiddenException('Account suspended');

    // Rotate: revoke old, issue new
    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    return this.generateTokens(stored.userId, stored.user.role, ip, userAgent);
  }

  // ── Logout ─────────────────────────────────────────────────
  async logout(rawToken: string) {
    if (!rawToken) return;
    const tokenHash = this.hashToken(rawToken);
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash },
      data: { revokedAt: new Date() },
    });
  }

  // ── Forgot password ────────────────────────────────────────
  async forgotPassword(dto: ForgotPasswordDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });

    // Always return success — don't reveal whether email exists
    if (!user) return { message: 'If that email exists, a reset link has been sent' };

    // Invalidate any existing tokens
    await this.prisma.passwordResetToken.deleteMany({ where: { userId: user.id } });

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = this.hashToken(rawToken);

    await this.prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt: new Date(Date.now() + RESET_TOKEN_HOURS * 3_600_000),
      },
    });

    // TODO: send email with rawToken — integrate your mailer here
    // await this.mailer.send({ to: user.email, token: rawToken });

    return { message: 'If that email exists, a reset link has been sent' };
  }

  // ── Reset password ─────────────────────────────────────────
  async resetPassword(dto: ResetPasswordDto) {
    const tokenHash = this.hashToken(dto.token);
    const record = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash },
    });

    if (!record || record.usedAt || record.expiresAt < new Date()) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, BCRYPT_ROUNDS);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: record.userId },
        data: { passwordHash, failedLoginAttempts: 0, lockedUntil: null },
      }),
      this.prisma.passwordResetToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      }),
      // Revoke all refresh tokens (force re-login everywhere)
      this.prisma.refreshToken.updateMany({
        where: { userId: record.userId },
        data: { revokedAt: new Date() },
      }),
    ]);

    return { message: 'Password updated successfully' };
  }

  // ── Helpers ────────────────────────────────────────────────
  private async generateTokens(
    userId: string, role: string, ip: string, userAgent: string,
  ) {
    const accessToken = this.jwt.sign(
      { sub: userId, role },
      { expiresIn: `${ACCESS_TOKEN_MINUTES}m` },
    );

    const rawRefresh = crypto.randomBytes(40).toString('hex');
    const tokenHash = this.hashToken(rawRefresh);

    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash,
        ipAddress: ip,
        userAgent,
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_DAYS * 86_400_000),
      },
    });

    return { accessToken, refreshToken: rawRefresh };
  }

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }
}

// ── auth.controller.ts ────────────────────────────────────────
import {
  Controller, Post, Body, Req, Res, HttpCode, HttpStatus, Get,
  UseGuards,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  path: '/api/v1/auth',
};

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('register')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async login(@Body() dto: LoginDto, @Req() req: Request, @Res() res: Response) {
    const ip = req.ip ?? 'unknown';
    const ua = req.headers['user-agent'] ?? '';
    const { user, accessToken, refreshToken } = await this.authService.login(dto, ip, ua);

    res.cookie('refresh_token', refreshToken, COOKIE_OPTIONS);
    res.json({ user, accessToken });
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Req() req: Request, @Res() res: Response) {
    const rawToken = req.cookies?.refresh_token;
    if (!rawToken) throw new UnauthorizedException('No refresh token');

    const ip = req.ip ?? 'unknown';
    const ua = req.headers['user-agent'] ?? '';
    const { accessToken, refreshToken } = await this.authService.refresh(rawToken, ip, ua);

    res.cookie('refresh_token', refreshToken, COOKIE_OPTIONS);
    res.json({ accessToken });
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Req() req: Request, @Res() res: Response) {
    const rawToken = req.cookies?.refresh_token;
    await this.authService.logout(rawToken);
    res.clearCookie('refresh_token', { path: '/api/v1/auth' });
    res.send();
  }

  @Post('forgot-password')
  @Throttle({ default: { limit: 3, ttl: 300_000 } })
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  @Post('reset-password')
  @Throttle({ default: { limit: 3, ttl: 300_000 } })
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  getMe(@Req() req: Request) {
    return req.user;
  }
}
