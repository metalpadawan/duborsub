// src/auth/auth.service.spec.ts
// Unit tests for AuthService — covers register, login, brute-force lockout,
// password reset token generation, and refresh token rotation.

import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';

// ── Minimal Prisma mock ───────────────────────────────────────
const mockPrisma = {
  user: {
    findFirst:  jest.fn(),
    findUnique: jest.fn(),
    create:     jest.fn(),
    update:     jest.fn(),
  },
  refreshToken:        { create: jest.fn(), findUnique: jest.fn(), update: jest.fn(), updateMany: jest.fn() },
  passwordResetToken:  { create: jest.fn(), findUnique: jest.fn(), update: jest.fn(), deleteMany: jest.fn() },
  $transaction:        jest.fn((ops: any[]) => Promise.all(ops)),
};

const mockJwt    = { sign: jest.fn().mockReturnValue('mock.jwt.token') };
const mockConfig = { get: jest.fn(), getOrThrow: jest.fn() };
const mockMail   = { sendPasswordReset: jest.fn(), sendWelcome: jest.fn() };

// We import only the service class (not the full module) to avoid DB connections
// Adjust the import path if you've split the file
describe('AuthService', () => {
  let service: any; // typed as any to avoid full import chain in this snippet

  const makeUser = (overrides = {}) => ({
    id: 'user-uuid-1',
    username: 'testuser',
    email: 'test@example.com',
    passwordHash: '$2b$12$hashedpassword',
    role: 'user',
    isBanned: false,
    bannedUntil: null,
    failedLoginAttempts: 0,
    lockedUntil: null,
    lastLoginAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

  beforeEach(async () => {
    jest.clearAllMocks();

    // Lazy-import to avoid top-level import issues with the combined file
    const { AuthService } = await import('./auth.module') as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: 'PrismaService',  useValue: mockPrisma },
        { provide: JwtService,       useValue: mockJwt },
        { provide: ConfigService,    useValue: mockConfig },
        { provide: 'MailService',    useValue: mockMail },
      ],
    }).compile();

    service = module.get(AuthService);
  });

  // ── register ───────────────────────────────────────────────
  describe('register()', () => {
    it('creates a user when email and username are unique', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue(makeUser());

      const result = await service.register({
        username: 'testuser',
        email: 'test@example.com',
        password: 'Password1!',
      });

      expect(mockPrisma.user.create).toHaveBeenCalledTimes(1);
      expect(result).toHaveProperty('id');
    });

    it('throws ConflictException when email already exists', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(makeUser());

      await expect(
        service.register({ username: 'other', email: 'test@example.com', password: 'Password1!' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  // ── login ──────────────────────────────────────────────────
  describe('login()', () => {
    it('returns tokens on valid credentials', async () => {
      const hash = await bcrypt.hash('Password1!', 4); // low rounds for test speed
      const user = makeUser({ passwordHash: hash });

      mockPrisma.user.findUnique.mockResolvedValue(user);
      mockPrisma.user.update.mockResolvedValue(user);
      mockPrisma.refreshToken.create.mockResolvedValue({});

      const result = await service.login(
        { email: 'test@example.com', password: 'Password1!' },
        '127.0.0.1', 'jest',
      );

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
    });

    it('throws UnauthorizedException on wrong password', async () => {
      const hash = await bcrypt.hash('CorrectPassword1!', 4);
      const user = makeUser({ passwordHash: hash });

      mockPrisma.user.findUnique.mockResolvedValue(user);
      mockPrisma.user.update.mockResolvedValue({ ...user, failedLoginAttempts: 1 });

      await expect(
        service.login({ email: 'test@example.com', password: 'WrongPassword1!' }, '127.0.0.1', 'jest'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws ForbiddenException when account is locked', async () => {
      const user = makeUser({ lockedUntil: new Date(Date.now() + 600_000) });
      mockPrisma.user.findUnique.mockResolvedValue(user);

      await expect(
        service.login({ email: 'test@example.com', password: 'Password1!' }, '127.0.0.1', 'jest'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws UnauthorizedException when user not found (timing-safe)', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.login({ email: 'ghost@example.com', password: 'Password1!' }, '127.0.0.1', 'jest'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('locks the account after 5 failed attempts', async () => {
      const hash = await bcrypt.hash('CorrectPassword1!', 4);
      const user = makeUser({ passwordHash: hash, failedLoginAttempts: 4 });

      mockPrisma.user.findUnique.mockResolvedValue(user);
      mockPrisma.user.update.mockResolvedValue({});

      await expect(
        service.login({ email: 'test@example.com', password: 'WrongPassword1!' }, '127.0.0.1', 'jest'),
      ).rejects.toThrow(UnauthorizedException);

      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ lockedUntil: expect.any(Date) }),
        }),
      );
    });
  });

  // ── forgotPassword ─────────────────────────────────────────
  describe('forgotPassword()', () => {
    it('always returns success message (no email leak)', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      const result = await service.forgotPassword({ email: 'nobody@example.com' });
      expect(result.message).toMatch(/if that email/i);
    });

    it('creates a reset token when user exists', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(makeUser());
      mockPrisma.passwordResetToken.deleteMany.mockResolvedValue({});
      mockPrisma.passwordResetToken.create.mockResolvedValue({});

      await service.forgotPassword({ email: 'test@example.com' });

      expect(mockPrisma.passwordResetToken.create).toHaveBeenCalledTimes(1);
      // Raw token must NOT be stored — only its hash
      const createCall = mockPrisma.passwordResetToken.create.mock.calls[0][0];
      expect(createCall.data).toHaveProperty('tokenHash');
      expect(createCall.data.tokenHash).not.toHaveLength(0);
    });
  });

  // ── refresh ────────────────────────────────────────────────
  describe('refresh()', () => {
    it('rotates the refresh token and returns new pair', async () => {
      const stored = {
        id: 'rt-1', userId: 'user-uuid-1', revokedAt: null,
        expiresAt: new Date(Date.now() + 86_400_000),
        user: makeUser(),
      };
      mockPrisma.refreshToken.findUnique.mockResolvedValue(stored);
      mockPrisma.refreshToken.update.mockResolvedValue({});
      mockPrisma.refreshToken.create.mockResolvedValue({});

      const result = await service.refresh('valid-raw-token', '127.0.0.1', 'jest');

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      // Old token must be revoked
      expect(mockPrisma.refreshToken.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ revokedAt: expect.any(Date) }) }),
      );
    });

    it('revokes ALL tokens on reuse detection', async () => {
      const stored = {
        id: 'rt-1', userId: 'user-uuid-1',
        revokedAt: new Date(), // already revoked = reuse!
        expiresAt: new Date(Date.now() + 86_400_000),
        user: makeUser(),
      };
      mockPrisma.refreshToken.findUnique.mockResolvedValue(stored);
      mockPrisma.refreshToken.updateMany.mockResolvedValue({});

      await expect(
        service.refresh('reused-raw-token', '127.0.0.1', 'jest'),
      ).rejects.toThrow(UnauthorizedException);

      expect(mockPrisma.refreshToken.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ data: { revokedAt: expect.any(Date) } }),
      );
    });
  });
});
