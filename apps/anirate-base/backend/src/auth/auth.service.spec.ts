import { describe, expect, it, beforeEach, jest } from '@jest/globals';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { ConflictException, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AuthService, ROTATION_GRACE_MS } from './auth.service';
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
  let configValues: Record<string, unknown>;

  beforeEach(() => {
    jwt = {
      signAsync: jest.fn(async () => 'signed-access-token'),
    } as unknown as JwtService;

    configValues = {
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

  it('revokes every session when a rotated refresh token is reused after the grace window', async () => {
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
    data.refreshTokens[0].revokedAt = new Date(Date.now() - ROTATION_GRACE_MS - 1_000);

    await expect(service.refresh(loginResult.refreshToken, '127.0.0.1', 'jest')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );

    expect(data.refreshTokens.every((token) => token.revokedAt instanceof Date)).toBe(true);
  });

  it('rejects a just-rotated token without revoking the session that replaced it', async () => {
    const user = createUser();
    const data = createDataServiceMock([user]);
    const service = new AuthService(data as unknown as DataService, jwt, config, monitoring);

    const loginResult = await service.login({ email: user.email, password: 'Password123!' }, '127.0.0.1', 'jest');
    const rotated = await service.refresh(loginResult.refreshToken, '127.0.0.1', 'jest');

    // A second tab presenting the old cookie a moment later.
    await expect(service.refresh(loginResult.refreshToken, '127.0.0.1', 'jest')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );

    expect(data.refreshTokens[1].revokedAt).toBeNull();
    await expect(service.refresh(rotated.refreshToken, '127.0.0.1', 'jest')).resolves.toHaveProperty('accessToken');
  });

  it('keeps the session when the user agent changes, and records the mismatch', async () => {
    const user = createUser();
    const data = createDataServiceMock([user]);
    const service = new AuthService(data as unknown as DataService, jwt, config, monitoring);

    const loginResult = await service.login({ email: user.email, password: 'Password123!' }, '127.0.0.1', 'Browser/1');

    await expect(service.refresh(loginResult.refreshToken, '127.0.0.1', 'Browser/2')).resolves.toHaveProperty(
      'accessToken',
    );
    expect(monitoring.recordSecurityEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'auth.refresh.user_agent_mismatch' }),
    );
  });

  it('does not reveal lock status to someone with the wrong password', async () => {
    const user = createUser({ failedLoginAttempts: 5, lockedUntil: new Date(Date.now() + 60_000) });
    const data = createDataServiceMock([user]);
    const service = new AuthService(data as unknown as DataService, jwt, config, monitoring);

    await expect(
      service.login({ email: user.email, password: 'DefinitelyWrong123!' }, '127.0.0.1', 'jest'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(
      service.login({ email: user.email, password: 'Password123!' }, '127.0.0.1', 'jest'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(user.failedLoginAttempts).toBe(5);
  });

  it('starts the failed-attempt count over once a lock has expired', async () => {
    const user = createUser({ failedLoginAttempts: 5, lockedUntil: new Date(Date.now() - 1_000) });
    const data = createDataServiceMock([user]);
    const service = new AuthService(data as unknown as DataService, jwt, config, monitoring);

    await expect(
      service.login({ email: user.email, password: 'DefinitelyWrong123!' }, '127.0.0.1', 'jest'),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(user.failedLoginAttempts).toBe(1);
    expect(user.lockedUntil).toBeNull();
  });

  it('runs a password comparison even when the email is unknown', async () => {
    const data = createDataServiceMock();
    const service = new AuthService(data as unknown as DataService, jwt, config, monitoring);
    // Spy on the CommonJS module object; the namespace import's properties are read-only.
    const compare = jest.spyOn(jest.requireActual<typeof bcrypt>('bcrypt'), 'compare');

    await expect(
      service.login({ email: 'nobody@example.com', password: 'Password123!' }, '127.0.0.1', 'jest'),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(compare).toHaveBeenCalledTimes(1);
    compare.mockRestore();
  });

  it('lets only one of two concurrent registrations for the same email succeed', async () => {
    const data = createDataServiceMock();
    const service = new AuthService(data as unknown as DataService, jwt, config, monitoring);
    const dto: RegisterDto = { username: 'racer', email: 'racer@example.com', password: 'Password123!' };

    const results = await Promise.allSettled([
      service.register(dto),
      service.register({ ...dto, username: 'racer2' }),
    ]);

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.find((result) => result.status === 'rejected')).toMatchObject({
      reason: expect.any(ConflictException),
    });
    expect(data.users).toHaveLength(1);
  });

  it('does not return the reset token unless EXPOSE_RESET_TOKEN is enabled', async () => {
    const user = createUser();
    const data = createDataServiceMock([user]);
    const service = new AuthService(data as unknown as DataService, jwt, config, monitoring);

    const response = await service.forgotPassword({ email: user.email });

    expect(response).not.toHaveProperty('debugToken');
    expect(data.passwordResetTokens).toHaveLength(1);
  });

  it('issues a debug reset token when enabled and updates the password when it is used', async () => {
    configValues.EXPOSE_RESET_TOKEN = true;
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
