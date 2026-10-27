import { afterAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { ForbiddenException } from '@nestjs/common';
import { CommentsService } from '../comments/comments.service';
import { DubReportsService } from '../dub-reports/dub-reports.service';
import { AnimeService } from '../anime/anime.service';
import { MonitoringService } from '../monitoring/monitoring.service';
import { TitleRequestsService } from '../title-requests/title-requests.service';
import { createAnime, createTestPrisma, createUser, resetDatabase } from '../test-utils/database';
import { AdminService } from './admin.service';

const prisma = createTestPrisma();
const monitoring = { recordSecurityEvent: jest.fn() } as unknown as MonitoringService;
const service = new AdminService(
  prisma,
  new CommentsService(prisma),
  monitoring,
  new DubReportsService(prisma),
  new TitleRequestsService(prisma, new AnimeService(prisma)),
);

beforeEach(async () => {
  await resetDatabase(prisma);
  await createUser(prisma, { id: 'seed-user-admin', username: 'admin', role: 'admin' });
  await createUser(prisma, { id: 'seed-user-demo', username: 'demo' });
  await prisma.refreshToken.create({
    data: { id: 't1', userId: 'seed-user-demo', tokenHash: 'h', expiresAt: new Date(Date.now() + 60_000) },
  });
});
afterAll(() => prisma.$disconnect());

describe('AdminService', () => {
  it('bans a user, revokes their sessions, and writes an audit log', async () => {
    await service.banUser('seed-user-admin', 'seed-user-demo', { reason: 'spam', durationDays: 3 }, '127.0.0.1');

    const target = await prisma.user.findUniqueOrThrow({ where: { id: 'seed-user-demo' } });
    expect(target.isBanned).toBe(true);
    expect(target.bannedUntil).toBeInstanceOf(Date);
    expect((await prisma.refreshToken.findUniqueOrThrow({ where: { id: 't1' } })).revokedAt).toBeInstanceOf(Date);
    expect(await prisma.adminLog.count({ where: { action: 'BAN_USER' } })).toBe(1);
  });

  it('refuses to ban admin accounts', async () => {
    await expect(service.banUser('seed-user-admin', 'seed-user-admin', {}, '127.0.0.1')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('confirms a reported dub and logs who did it', async () => {
    await createAnime(prisma, { id: 'mal-1', hasDub: false });
    await prisma.dubReport.create({ data: { id: 'r1', animeId: 'mal-1', userId: 'seed-user-demo' } });

    expect((await service.getDashboardStats()).counts.pendingDubReports).toBe(1);
    await service.confirmDub('seed-user-admin', 'mal-1', '127.0.0.1');

    expect((await prisma.anime.findUniqueOrThrow({ where: { id: 'mal-1' } })).hasDub).toBe(true);
    expect((await service.getDashboardStats()).counts.pendingDubReports).toBe(0);
    expect((await service.getAdminLogs({ page: 1, limit: 20 })).items[0]).toMatchObject({
      action: 'CONFIRM_DUB',
      admin: { username: 'admin' },
    });
  });
});
