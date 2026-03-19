// ============================================================
// OAUTH MODULE — Google + Discord
// Install: npm install passport-google-oauth20 passport-discord
//          npm install @types/passport-google-oauth20
// ============================================================

// ── oauth.dto.ts ──────────────────────────────────────────────
export interface OAuthProfile {
  provider:    'google' | 'discord';
  providerId:  string;
  email:       string;
  username:    string;
  avatarUrl?:  string;
}

// ── Prisma schema additions ───────────────────────────────────
/*
model OAuthAccount {
  id         String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  userId     String   @map("user_id") @db.Uuid
  provider   String   @db.VarChar(20)   // 'google' | 'discord'
  providerId String   @map("provider_id")
  createdAt  DateTime @default(now()) @map("created_at") @db.Timestamptz()

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerId])
  @@map("oauth_accounts")
}

// Add to User model:
//   oauthAccounts OAuthAccount[]
//   passwordHash  String?   // make nullable — OAuth users have no password
*/

// ── SQL migration ─────────────────────────────────────────────
/*
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;

CREATE TABLE oauth_accounts (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID         NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  provider    VARCHAR(20)  NOT NULL,
  provider_id TEXT         NOT NULL,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (provider, provider_id)
);
CREATE INDEX idx_oauth_user ON oauth_accounts (user_id);
*/

// ── oauth.service.ts ──────────────────────────────────────────
import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../common/prisma/prisma.service';
import * as crypto from 'crypto';

@Injectable()
export class OAuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
  ) {}

  // Called by both Google and Discord strategies after profile resolved
  async handleOAuthLogin(profile: OAuthProfile, ip: string, ua: string) {
    // 1. Check for existing OAuth link
    const existing = await this.prisma.oAuthAccount.findUnique({
      where: { provider_providerId: { provider: profile.provider, providerId: profile.providerId } },
      include: { user: true },
    });

    if (existing) {
      return this.issueTokens(existing.user.id, existing.user.role, ip, ua);
    }

    // 2. Try to link to existing user by email
    const userByEmail = await this.prisma.user.findUnique({ where: { email: profile.email } });
    if (userByEmail) {
      await this.prisma.oAuthAccount.create({
        data: { userId: userByEmail.id, provider: profile.provider, providerId: profile.providerId },
      });
      return this.issueTokens(userByEmail.id, userByEmail.role, ip, ua);
    }

    // 3. Create new user + link
    const username = await this.generateUniqueUsername(profile.username);
    const user = await this.prisma.$transaction(async (tx) => {
      const u = await tx.user.create({
        data: {
          username,
          email: profile.email,
          passwordHash: null, // OAuth users have no password
        },
      });
      await tx.oAuthAccount.create({
        data: { userId: u.id, provider: profile.provider, providerId: profile.providerId },
      });
      return u;
    });

    return this.issueTokens(user.id, user.role, ip, ua);
  }

  private async issueTokens(userId: string, role: string, ip: string, ua: string) {
    const accessToken = this.jwt.sign(
      { sub: userId, role },
      { expiresIn: '15m', secret: this.config.getOrThrow('JWT_SECRET') },
    );

    const rawRefresh = crypto.randomBytes(40).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawRefresh).digest('hex');

    await this.prisma.refreshToken.create({
      data: {
        userId, tokenHash, ipAddress: ip, userAgent: ua,
        expiresAt: new Date(Date.now() + 7 * 86_400_000),
      },
    });

    return { accessToken, refreshToken: rawRefresh, userId };
  }

  private async generateUniqueUsername(base: string): Promise<string> {
    // Sanitise: lowercase, alphanumeric + underscore only
    const clean = base.toLowerCase().replace(/[^a-z0-9_]/g, '_').slice(0, 25);
    let candidate = clean;
    let attempts = 0;
    while (attempts < 10) {
      const exists = await this.prisma.user.findUnique({ where: { username: candidate } });
      if (!exists) return candidate;
      candidate = `${clean}_${Math.floor(Math.random() * 9000 + 1000)}`;
      attempts++;
    }
    return `${clean}_${Date.now()}`;
  }
}

// ── strategies/google.strategy.ts ────────────────────────────
import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy as GoogleStrategy, Profile } from 'passport-google-oauth20';

@Injectable()
export class GoogleOAuthStrategy extends PassportStrategy(GoogleStrategy, 'google') {
  constructor(config: ConfigService) {
    super({
      clientID:     config.getOrThrow('GOOGLE_CLIENT_ID'),
      clientSecret: config.getOrThrow('GOOGLE_CLIENT_SECRET'),
      callbackURL:  config.getOrThrow('GOOGLE_CALLBACK_URL'),
      scope: ['email', 'profile'],
    });
  }

  async validate(_at: string, _rt: string, profile: Profile): Promise<OAuthProfile> {
    return {
      provider:   'google',
      providerId: profile.id,
      email:      profile.emails?.[0]?.value ?? '',
      username:   profile.displayName ?? profile.username ?? 'user',
      avatarUrl:  profile.photos?.[0]?.value,
    };
  }
}

// ── strategies/discord.strategy.ts ───────────────────────────
import { Strategy as DiscordStrategy, Profile as DiscordProfile } from 'passport-discord';

@Injectable()
export class DiscordOAuthStrategy extends PassportStrategy(DiscordStrategy, 'discord') {
  constructor(config: ConfigService) {
    super({
      clientID:     config.getOrThrow('DISCORD_CLIENT_ID'),
      clientSecret: config.getOrThrow('DISCORD_CLIENT_SECRET'),
      callbackURL:  config.getOrThrow('DISCORD_CALLBACK_URL'),
      scope: ['identify', 'email'],
    });
  }

  async validate(_at: string, _rt: string, profile: DiscordProfile): Promise<OAuthProfile> {
    const avatarUrl = profile.avatar
      ? `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.png`
      : undefined;
    return {
      provider:   'discord',
      providerId: profile.id,
      email:      profile.email ?? '',
      username:   profile.username ?? 'user',
      avatarUrl,
    };
  }
}

// ── oauth.controller.ts ───────────────────────────────────────
import {
  Controller, Get, Req, Res, UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Request, Response } from 'express';

const COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,  // lax required for OAuth redirect
  maxAge: 7 * 24 * 60 * 60 * 1000,
  path: '/api/v1/auth',
};

@Controller('auth')
export class OAuthController {
  constructor(private oauthService: OAuthService) {}

  // ── Google ─────────────────────────────────────────────────
  @Get('google')
  @UseGuards(AuthGuard('google'))
  googleLogin() { /* Passport redirects */ }

  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleCallback(@Req() req: Request, @Res() res: Response) {
    return this.handleCallback(req, res);
  }

  // ── Discord ────────────────────────────────────────────────
  @Get('discord')
  @UseGuards(AuthGuard('discord'))
  discordLogin() { /* Passport redirects */ }

  @Get('discord/callback')
  @UseGuards(AuthGuard('discord'))
  async discordCallback(@Req() req: Request, @Res() res: Response) {
    return this.handleCallback(req, res);
  }

  private async handleCallback(req: Request, res: Response) {
    const profile = req.user as OAuthProfile;
    const ip = req.ip ?? '';
    const ua = req.headers['user-agent'] ?? '';
    const { accessToken, refreshToken } = await this.oauthService.handleOAuthLogin(profile, ip, ua);
    const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:3000';

    res.cookie('refresh_token', refreshToken, COOKIE_OPTS);
    // Redirect to frontend with access token in query (frontend reads it once and discards)
    res.redirect(`${frontendUrl}/oauth/callback?token=${accessToken}`);
  }
}

// ── oauth.module.ts ───────────────────────────────────────────
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';

@Module({
  imports: [PassportModule, JwtModule.register({})],
  controllers: [OAuthController],
  providers: [OAuthService, GoogleOAuthStrategy, DiscordOAuthStrategy],
})
export class OAuthModule {}

// ── Environment variables ─────────────────────────────────────
/*
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_CALLBACK_URL=https://your-api.railway.app/api/v1/auth/google/callback

DISCORD_CLIENT_ID=your_discord_client_id
DISCORD_CLIENT_SECRET=your_discord_client_secret
DISCORD_CALLBACK_URL=https://your-api.railway.app/api/v1/auth/discord/callback
*/

// ── Google setup ──────────────────────────────────────────────
/*
1. console.cloud.google.com → New project → APIs & Services → Credentials
2. Create OAuth 2.0 Client ID (Web application)
3. Add Authorized redirect URI: https://your-api.railway.app/api/v1/auth/google/callback
4. Copy Client ID and Client Secret to env
*/

// ── Discord setup ─────────────────────────────────────────────
/*
1. discord.com/developers/applications → New Application
2. OAuth2 → Add Redirect: https://your-api.railway.app/api/v1/auth/discord/callback
3. Copy Client ID and Client Secret to env
*/
