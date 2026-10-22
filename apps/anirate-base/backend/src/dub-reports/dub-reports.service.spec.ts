import { afterAll, beforeEach, describe, expect, it } from '@jest/globals';
import { NotFoundException } from '@nestjs/common';
import { createAnime, createTestPrisma, createUser, resetDatabase } from '../test-utils/database';
import { DUB_CONFIRM_THRESHOLD, DubReportsService } from './dub-reports.service';

const prisma = createTestPrisma();
const service = new DubReportsService(prisma);

beforeEach(async () => {
  await resetDatabase(prisma);
  await createAnime(prisma, { id: 'mal-1', hasDub: false });
});
afterAll(() => prisma.$disconnect());

describe('DubReportsService', () => {
  it('counts each viewer once', async () => {
    const user = await createUser(prisma);

    await service.report('mal-1', user.id);
    const state = await service.report('mal-1', user.id);

    expect(state).toMatchObject({ hasDub: false, reports: 1, reportedByMe: true });
  });

  it('marks the title dubbed once enough different viewers report it, and clears the reports', async () => {
    const users = await Promise.all(Array.from({ length: DUB_CONFIRM_THRESHOLD }, () => createUser(prisma)));

    for (const user of users.slice(0, -1)) {
      await service.report('mal-1', user.id);
    }
    expect((await prisma.anime.findUniqueOrThrow({ where: { id: 'mal-1' } })).hasDub).toBe(false);

    const state = await service.report('mal-1', users[users.length - 1].id);

    expect(state).toMatchObject({ hasDub: true, reports: 0 });
  });

  it('lets a viewer withdraw a report, and an admin dismiss or confirm the rest', async () => {
    const [one, two, three] = await Promise.all([createUser(prisma), createUser(prisma), createUser(prisma)]);
    await service.report('mal-1', one.id);
    await service.report('mal-1', two.id);

    expect(await service.withdraw('mal-1', one.id)).toMatchObject({ reports: 1, reportedByMe: false });
    expect((await service.listPending()).items).toEqual([expect.objectContaining({ reports: 1 })]);

    await service.dismiss('mal-1');
    expect((await service.listPending()).items).toEqual([]);

    await service.report('mal-1', three.id);
    await service.markDubbed('mal-1');
    expect((await prisma.anime.findUniqueOrThrow({ where: { id: 'mal-1' } })).hasDub).toBe(true);
    expect(await prisma.dubReport.count()).toBe(0);
  });

  it('rejects reports for titles that do not exist', async () => {
    const user = await createUser(prisma);

    await expect(service.report('missing', user.id)).rejects.toBeInstanceOf(NotFoundException);
  });
});
