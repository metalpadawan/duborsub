import { describe, expect, it, jest } from '@jest/globals';
import { ForbiddenException } from '@nestjs/common';
import { AdminService } from './admin.service';
import { CommentsService } from '../comments/comments.service';
import { DataService, RefreshTokenRecord, UserRecord } from '../data/data.service';
import { MonitoringService } from '../monitoring/monitoring.service';

function createUser(id: string, role: UserRecord['role']): UserRecord {
  const now = new Date('2026-01-01T00:00:00.000Z');
  return {
    id,
    username: id,
    email: `${id}@example.com`,
    passwordHash: 'hash',
    role,
    isBanned: false,
    banReason: null,
    bannedUntil: null,
    failedLoginAttempts: 0,
    lockedUntil: null,
    lastLoginAt: null,
    createdAt: now,
    updatedAt: now,
  };
}

function createAdminService() {
  const users = [createUser('seed-user-admin', 'admin'), createUser('seed-user-demo', 'user')];
  const refreshTokens: RefreshTokenRecord[] = [
    {
      id: 't1',
      userId: 'seed-user-demo',
      tokenHash: 'h',
      ipAddress: null,
      userAgent: null,
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt: null,
      replacedByTokenId: null,
      createdAt: new Date(),
    },
  ];
  const data = {
    users,
    refreshTokens,
    adminLogs: [],
    findUserById: (id: string) => users.find((user) => user.id === id) ?? null,
    save: jest.fn(),
  };
  const monitoring = { recordSecurityEvent: jest.fn() } as unknown as MonitoringService;
  const service = new AdminService(data as unknown as DataService, {} as CommentsService, monitoring);

  return { service, data };
}

describe('AdminService', () => {
  it('bans a seeded user, revokes their sessions, and writes an audit log', () => {
    const { service, data } = createAdminService();

    service.banUser('seed-user-admin', 'seed-user-demo', { reason: 'spam', durationDays: 3 }, '127.0.0.1');

    const target = data.users[1];
    expect(target.isBanned).toBe(true);
    expect(target.bannedUntil).toBeInstanceOf(Date);
    expect(data.refreshTokens[0].revokedAt).toBeInstanceOf(Date);
    expect(data.adminLogs).toHaveLength(1);
  });

  it('refuses to ban admin accounts', () => {
    const { service } = createAdminService();

    expect(() => service.banUser('seed-user-admin', 'seed-user-admin', {}, '127.0.0.1')).toThrow(ForbiddenException);
  });
});
