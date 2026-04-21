import { describe, expect, it, beforeEach, jest } from '@jest/globals';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { LoginDto, RegisterDto, ResetPasswordDto } from './dto/auth.dto';
import { DataService, PasswordResetTokenRecord, RefreshTokenRecord, UserRecord } from '../data/data.service';
import { MonitoringService } from '../monitoring/monitoring.service';

type DataServiceMock = Pick<
  DataService,
  'users' | 'refreshTokens' | 'passwordResetTokens' | 'findUserByEmail' | 'findUserByUsername' | 'findUserById' | 'save'
>;

function createUser(overrides: Partial<UserRecord> = {}): UserRecord {
  const now = new Date('2026-01-01T00:00:00.000Z');

  return {
    id: 'user-1',
    username: 'demo',
    email: 'demo@example.com',
    passwordHash: bcrypt.hashSync('Password123!', 10),
    role: 'user',
    isBanned: false,
    banReason: null,
    bannedUntil: null,
    failedLoginAttempts: 0,
    lockedUntil: null,
    lastLoginAt: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function createDataServiceMock(initialUsers: UserRecord[] = []): DataServiceMock {
  const users = [...initialUsers];
  const refreshTokens: RefreshTokenRecord[] = [];
  const passwordResetTokens: PasswordResetTokenRecord[] = [];

  return {
    users,
    refreshTokens,
    passwordResetTokens,
    findUserByEmail: (email: string) =>
      users.find((user) => user.email.toLowerCase() === email.toLowerCase()) ?? null,
    findUserByUsername: (username: string) =>
      users.find((user) => user.username.toLowerCase() === username.toLowerCase()) ?? null,
    findUserById: (id: string) => users.find((user) => user.id === id) ?? null,
    save: jest.fn(),
  };
}

describe('AuthService', () => {
  let jwt: JwtService;
  let config: ConfigService;
  let monitoring: MonitoringService;

  beforeEach(() => {
    jwt = {
      signAsync: jest.fn(async () => 'signed-access-token'),
    } as unknown as JwtService;

    const configValues: Record<string, unknown> = {
      NODE_ENV: 'development',
      ACCESS_TOKEN_TTL_MINUTES: 10,
      REFRESH_TOKEN_TTL_HOURS: 24,
      JWT_ISSUER: 'anirate-api',
      JWT_AUDIENCE: 'anirate-web',
    };

    config = {
      get: jest.fn().mockImplementation((key: string, fallback?: string) => {
        return key in configValues ? configValues[key] : fallback;
      }),
      getOrThrow: jest.fn().mockImplementation((key: string) => {
        if (!(key in configValues)) {
          throw new Error(`Missing config value for ${key}`);
        }

        return configValues[key];
      }),
    } as unknown as ConfigService;

    monitoring = {
      recordSecurityEvent: jest.fn(),
    } as unknown as MonitoringService;
  });

  it('registers a new user, lowercases the email, and persists the change', async () => {
    const data = createDataServiceMock();
    const service = new AuthService(data as unknown as DataService, jwt, config, monitoring);
    const dto: RegisterDto = {
      username: 'NewUser',
      email: 'NewUser@Example.com',
      password: 'Password123!',
    };

    const created = await service.register(dto);

    expect(created.email).toBe('newuser@example.com');
    expect(created.username).toBe('NewUser');
    expect(created).not.toHaveProperty('passwordHash');
    expect(data.users).toHaveLength(1);
    expect(data.users[0].passwordHash).not.toBe(dto.password);
    expect(data.save).toHaveBeenCalledTimes(1);
  });

  it('rejects invalid credentials and records the failed attempt', async () => {
    const user = createUser();
    const data = createDataServiceMock([user]);
    const service = new AuthService(data as unknown as DataService, jwt, config, monitoring);
    const dto: LoginDto = {
      email: user.email,
      password: 'DefinitelyWrong123!',
    };

    await expect(service.login(dto, '127.0.0.1', 'jest')).rejects.toBeInstanceOf(UnauthorizedException);

    expect(user.failedLoginAttempts).toBe(1);
    expect(data.save).toHaveBeenCalledTimes(1);
  });

  it('locks an account after too many failed login attempts', async () => {
    const user = createUser({ failedLoginAttempts: 4 });
    const data = createDataServiceMock([user]);
    const service = new AuthService(data as unknown as DataService, jwt, config, monitoring);

    await expect(
      service.login(
        {
          email: user.email,
          password: 'DefinitelyWrong123!',
        },
        '127.0.0.1',
        'jest',
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(user.failedLoginAttempts).toBe(5);
    expect(user.lockedUntil).toBeInstanceOf(Date);
  });

  it('returns tokens and rotates refresh sessions on successful login and refresh', async () => {
    const user = createUser();
    const data = createDataServiceMock([user]);
    const service = new AuthService(data as unknown as DataService, jwt, config, monitoring);

    const loginResult = await service.login(
      {
        email: user.email,
        password: 'Password123!',
      },
      '127.0.0.1',
      'jest',
    );

    expect(loginResult.accessToken).toBe('signed-access-token');
    expect(loginResult.refreshToken).toEqual(expect.any(String));
    expect(data.refreshTokens).toHaveLength(1);
    expect(data.save).toHaveBeenCalledTimes(1);

    const refreshResult = await service.refresh(loginResult.refreshToken, '127.0.0.1', 'jest');

    expect(refreshResult.accessToken).toBe('signed-access-token');
    expect(refreshResult.refreshToken).toEqual(expect.any(String));
    expect(data.refreshTokens).toHaveLength(2);
    expect(data.refreshTokens[0].revokedAt).toBeInstanceOf(Date);
    expect(data.save).toHaveBeenCalledTimes(2);
  });

  it('rejects refresh requests when the original session is missing', async () => {
    const user = createUser();
    const data = createDataServiceMock([user]);
    const service = new AuthService(data as unknown as DataService, jwt, config, monitoring);

    await expect(service.refresh('missing-token', '127.0.0.1', 'jest')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('revokes every session when a revoked refresh token is reused', async () => {
    const user = createUser();
    const data = createDataServiceMock([user]);
    const service = new AuthService(data as unknown as DataService, jwt, config, monitoring);

    const loginResult = await service.login(
      {
        email: user.email,
        password: 'Password123!',
      },
      '127.0.0.1',
      'jest',
    );

    await service.refresh(loginResult.refreshToken, '127.0.0.1', 'jest');

    await expect(service.refresh(loginResult.refreshToken, '127.0.0.1', 'jest')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );

    expect(data.refreshTokens.every((token) => token.revokedAt instanceof Date)).toBe(true);
  });

  it('issues a debug reset token in development and updates the password when it is used', async () => {
    const user = createUser();
    const data = createDataServiceMock([user]);
    const service = new AuthService(data as unknown as DataService, jwt, config, monitoring);

    const forgotPassword = await service.forgotPassword({ email: user.email });

    expect(forgotPassword).toHaveProperty('debugToken');
    expect(data.passwordResetTokens).toHaveLength(1);

    const resetDto: ResetPasswordDto = {
      token: String(forgotPassword.debugToken),
      newPassword: 'Different123!',
    };

    await expect(service.resetPassword(resetDto)).resolves.toEqual({
      message: 'Password updated successfully',
    });

    expect(await bcrypt.compare('Different123!', user.passwordHash)).toBe(true);
    expect(data.passwordResetTokens[0].usedAt).toBeInstanceOf(Date);
  });

  it('blocks login for a currently banned user', async () => {
    const user = createUser({
      isBanned: true,
      bannedUntil: new Date(Date.now() + 60_000),
    });
    const data = createDataServiceMock([user]);
    const service = new AuthService(data as unknown as DataService, jwt, config, monitoring);

    await expect(
      service.login(
        {
          email: user.email,
          password: 'Password123!',
        },
        '127.0.0.1',
        'jest',
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
