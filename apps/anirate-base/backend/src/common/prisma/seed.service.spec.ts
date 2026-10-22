import { afterAll, beforeEach, describe, expect, it } from '@jest/globals';
import { ConfigService } from '@nestjs/config';
import { createAnime, createTestPrisma, resetDatabase } from '../../test-utils/database';
import { GENRES, SAMPLE_ANIME, SeedService } from './seed.service';
import { TokenCleanupService } from './token-cleanup.service';

const prisma = createTestPrisma();

function seeder(values: Record<string, unknown>) {
  return new SeedService(prisma, { get: (key: string) => values[key] } as unknown as ConfigService);
}

beforeEach(() => resetDatabase(prisma));
afterAll(() => prisma.$disconnect());

describe('SeedService', () => {
  it('seeds demo accounts and the sample catalogue in development, once', async () => {
    await seeder({ NODE_ENV: 'development' }).seed();
    await seeder({ NODE_ENV: 'development' }).seed();

    expect((await prisma.user.findMany()).map((user) => user.email).sort()).toEqual([
      'admin@example.com',
      'demo@example.com',
      'otaku@example.com',
    ]);
    expect(await prisma.anime.count()).toBe(SAMPLE_ANIME.length);
    expect(await prisma.genre.count()).toBe(GENRES.length);
    expect(await prisma.anime.findUniqueOrThrow({ where: { id: SAMPLE_ANIME[0].id } })).toMatchObject({ totalVotes: 2, avgSubRating: 4.5 });
  });

  it('leaves an imported catalogue alone when the accounts are reset', async () => {
    await createAnime(prisma, { id: 'mal-1', title: 'Cowboy Bebop' });

    await seeder({ NODE_ENV: 'development' }).seed();

    expect((await prisma.anime.findMany()).map((anime) => anime.id)).toEqual(['mal-1']);
    expect(await prisma.user.count()).toBe(3);
  });

  it('never seeds the demo accounts in production', async () => {
    await seeder({ NODE_ENV: 'production' }).seed();

    expect(await prisma.user.count()).toBe(0);
    expect(await prisma.genre.count()).toBe(GENRES.length);
  });

  it('creates only the configured admin in production', async () => {
    await seeder({ NODE_ENV: 'production', SEED_ADMIN_EMAIL: 'Owner@Example.com', SEED_ADMIN_PASSWORD: 'a-long-random-password' }).seed();

    const users = await prisma.user.findMany();
    expect(users).toHaveLength(1);
    expect(users[0]).toMatchObject({ email: 'owner@example.com', role: 'admin' });
  });
});

describe('TokenCleanupService', () => {
  it('prunes expired sessions and spent reset tokens, keeping revoked live ones for reuse detection', async () => {
    await seeder({ NODE_ENV: 'development' }).seed();
    const past = new Date(Date.now() - 60_000);
    const future = new Date(Date.now() + 60_000);
    await prisma.refreshToken.createMany({
      data: [
        { id: 'expired', userId: 'seed-user-demo', tokenHash: 'a', expiresAt: past },
        { id: 'revoked-live', userId: 'seed-user-demo', tokenHash: 'b', expiresAt: future, revokedAt: past },
      ],
    });
    await prisma.passwordResetToken.createMany({
      data: [
        { id: 'used', userId: 'seed-user-demo', tokenHash: 'c', expiresAt: future, usedAt: past },
        { id: 'pending', userId: 'seed-user-demo', tokenHash: 'd', expiresAt: future },
      ],
    });

    await new TokenCleanupService(prisma).prune();

    expect((await prisma.refreshToken.findMany()).map((token) => token.id)).toEqual(['revoked-live']);
    expect((await prisma.passwordResetToken.findMany()).map((token) => token.id)).toEqual(['pending']);
  });
});
