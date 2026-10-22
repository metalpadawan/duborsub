import { afterAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { ConflictException, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { User } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { AuthService, ROTATION_GRACE_MS } from './auth.service';
import { LoginDto, RegisterDto, ResetPasswordDto } from './dto/auth.dto';
import { MonitoringService } from '../monitoring/monitoring.service';
import { createTestPrisma, createUser as insertUser, resetDatabase } from '../test-utils/database';

const prisma = createTestPrisma();

function createUser(overrides: Partial<User> = {}) {
  return insertUser(prisma, { id: 'user-1', username: 'demo', email: 'demo@example.com', ...overrides });
}

const reload = (id = 'user-1') => prisma.user.findUniqueOrThrow({ where: { id } });
const tokens = () => prisma.refreshToken.findMany({ orderBy: { createdAt: 'asc' } });

beforeEach(() => resetDatabase(prisma));
afterAll(() => prisma.$disconnect());

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
    const service = new AuthService(prisma, jwt, config, monitoring);
    const dto: RegisterDto = {
      username: 'NewUser',
      email: 'NewUser@Example.com',
      password: 'Password123!',
    };

    const created = await service.register(dto);

    expect(created.email).toBe('newuser@example.com');
    expect(created.username).toBe('NewUser');
    expect(created).not.toHaveProperty('passwordHash');
    const stored = await prisma.user.findMany();
    expect(stored).toHaveLength(1);
    expect(stored[0].passwordHash).not.toBe(dto.password);
  });

  it('rejects invalid credentials and records the failed attempt', async () => {
    const user = await createUser();
    const service = new AuthService(prisma, jwt, config, monitoring);
    const dto: LoginDto = {
      email: user.email,
      password: 'DefinitelyWrong123!',
    };

    await expect(service.login(dto, '127.0.0.1', 'jest')).rejects.toBeInstanceOf(UnauthorizedException);

    expect((await reload()).failedLoginAttempts).toBe(1);
  });

  it('locks an account after too many failed login attempts', async () => {
    const user = await createUser({ failedLoginAttempts: 4 });
    const service = new AuthService(prisma, jwt, config, monitoring);

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

    const locked = await reload();
    expect(locked.failedLoginAttempts).toBe(5);
    expect(locked.lockedUntil).toBeInstanceOf(Date);
  });

  it('returns tokens and rotates refresh sessions on successful login and refresh', async () => {
    const user = await createUser();
    const service = new AuthService(prisma, jwt, config, monitoring);

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
    expect(await tokens()).toHaveLength(1);

    const refreshResult = await service.refresh(loginResult.refreshToken, '127.0.0.1', 'jest');

    expect(refreshResult.accessToken).toBe('signed-access-token');
    expect(refreshResult.refreshToken).toEqual(expect.any(String));
    const rotated = await tokens();
    expect(rotated).toHaveLength(2);
    expect(rotated[0].revokedAt).toBeInstanceOf(Date);
    expect(rotated[0].replacedByTokenId).toBe(rotated[1].id);
  });

  it('rejects refresh requests when the original session is missing', async () => {
    await createUser();
    const service = new AuthService(prisma, jwt, config, monitoring);

    await expect(service.refresh('missing-token', '127.0.0.1', 'jest')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('revokes every session when a rotated refresh token is reused after the grace window', async () => {
    const user = await createUser();
    const service = new AuthService(prisma, jwt, config, monitoring);

    const loginResult = await service.login(
      {
        email: user.email,
        password: 'Password123!',
      },
      '127.0.0.1',
      'jest',
    );

    await service.refresh(loginResult.refreshToken, '127.0.0.1', 'jest');
    const [original] = await tokens();
    await prisma.refreshToken.update({
      where: { id: original.id },
      data: { revokedAt: new Date(Date.now() - ROTATION_GRACE_MS - 1_000) },
    });

    await expect(service.refresh(loginResult.refreshToken, '127.0.0.1', 'jest')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );

    expect((await tokens()).every((token) => token.revokedAt instanceof Date)).toBe(true);
  });

  it('rejects a just-rotated token without revoking the session that replaced it', async () => {
    const user = await createUser();
    const service = new AuthService(prisma, jwt, config, monitoring);

    const loginResult = await service.login({ email: user.email, password: 'Password123!' }, '127.0.0.1', 'jest');
    const rotated = await service.refresh(loginResult.refreshToken, '127.0.0.1', 'jest');

    // A second tab presenting the old cookie a moment later.
    await expect(service.refresh(loginResult.refreshToken, '127.0.0.1', 'jest')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );

    expect((await tokens())[1].revokedAt).toBeNull();
    await expect(service.refresh(rotated.refreshToken, '127.0.0.1', 'jest')).resolves.toHaveProperty('accessToken');
  });

  it('keeps the session when the user agent changes, and records the mismatch', async () => {
    const user = await createUser();
    const service = new AuthService(prisma, jwt, config, monitoring);

    const loginResult = await service.login({ email: user.email, password: 'Password123!' }, '127.0.0.1', 'Browser/1');

    await expect(service.refresh(loginResult.refreshToken, '127.0.0.1', 'Browser/2')).resolves.toHaveProperty(
      'accessToken',
    );
    expect(monitoring.recordSecurityEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'auth.refresh.user_agent_mismatch' }),
    );
  });

  it('does not reveal lock status to someone with the wrong password', async () => {
    const user = await createUser({ failedLoginAttempts: 5, lockedUntil: new Date(Date.now() + 60_000) });
    const service = new AuthService(prisma, jwt, config, monitoring);

    await expect(
      service.login({ email: user.email, password: 'DefinitelyWrong123!' }, '127.0.0.1', 'jest'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(
      service.login({ email: user.email, password: 'Password123!' }, '127.0.0.1', 'jest'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect((await reload()).failedLoginAttempts).toBe(5);
  });

  it('starts the failed-attempt count over once a lock has expired', async () => {
    const user = await createUser({ failedLoginAttempts: 5, lockedUntil: new Date(Date.now() - 1_000) });
    const service = new AuthService(prisma, jwt, config, monitoring);

    await expect(
      service.login({ email: user.email, password: 'DefinitelyWrong123!' }, '127.0.0.1', 'jest'),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    const reset = await reload();
    expect(reset.failedLoginAttempts).toBe(1);
    expect(reset.lockedUntil).toBeNull();
  });

  it('runs a password comparison even when the email is unknown', async () => {
    const service = new AuthService(prisma, jwt, config, monitoring);
    // Spy on the CommonJS module object; the namespace import's properties are read-only.
    const compare = jest.spyOn(jest.requireActual<typeof bcrypt>('bcrypt'), 'compare');

    await expect(
      service.login({ email: 'nobody@example.com', password: 'Password123!' }, '127.0.0.1', 'jest'),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(compare).toHaveBeenCalledTimes(1);
    compare.mockRestore();
  });

  it('lets only one of two concurrent registrations for the same email succeed', async () => {
    const service = new AuthService(prisma, jwt, config, monitoring);
    const dto: RegisterDto = { username: 'racer', email: 'racer@example.com', password: 'Password123!' };

    const results = await Promise.allSettled([
      service.register(dto),
      service.register({ ...dto, username: 'racer2' }),
    ]);

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.find((result) => result.status === 'rejected')).toMatchObject({
      reason: expect.any(ConflictException),
    });
    expect(await prisma.user.count()).toBe(1);
  });

  it('does not return the reset token unless EXPOSE_RESET_TOKEN is enabled', async () => {
    const user = await createUser();
    const service = new AuthService(prisma, jwt, config, monitoring);

    const response = await service.forgotPassword({ email: user.email });

    expect(response).not.toHaveProperty('debugToken');
    expect(await prisma.passwordResetToken.count()).toBe(1);
  });

  it('issues a debug reset token when enabled and updates the password when it is used', async () => {
    configValues.EXPOSE_RESET_TOKEN = true;
    const user = await createUser();
    const service = new AuthService(prisma, jwt, config, monitoring);

    const forgotPassword = await service.forgotPassword({ email: user.email });

    expect(forgotPassword).toHaveProperty('debugToken');
    expect(await prisma.passwordResetToken.count()).toBe(1);

    const resetDto: ResetPasswordDto = {
      token: String(forgotPassword.debugToken),
      newPassword: 'Different123!',
    };

    await expect(service.resetPassword(resetDto)).resolves.toEqual({
      message: 'Password updated successfully',
    });

    expect(await bcrypt.compare('Different123!', (await reload()).passwordHash)).toBe(true);
    expect((await prisma.passwordResetToken.findFirstOrThrow()).usedAt).toBeInstanceOf(Date);
    // The same link cannot be spent twice.
    await expect(service.resetPassword(resetDto)).rejects.toThrow('Invalid or expired reset token');
  });

  it('lets only one of two simultaneous refreshes rotate the same token', async () => {
    const user = await createUser();
    const service = new AuthService(prisma, jwt, config, monitoring);
    const { refreshToken } = await service.login({ email: user.email, password: 'Password123!' }, '127.0.0.1', 'jest');

    const results = await Promise.allSettled([
      service.refresh(refreshToken, '127.0.0.1', 'jest'),
      service.refresh(refreshToken, '127.0.0.1', 'jest'),
    ]);

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect((await tokens()).filter((token) => token.revokedAt === null)).toHaveLength(1);
  });

  it('blocks login for a currently banned user', async () => {
    const user = await createUser({
      isBanned: true,
      bannedUntil: new Date(Date.now() + 60_000),
    });
    const service = new AuthService(prisma, jwt, config, monitoring);

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
