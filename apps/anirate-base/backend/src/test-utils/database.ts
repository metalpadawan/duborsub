// Integration-test helpers: a client on the test database, a wipe between tests,
// and small factories for the rows most tests need.
import { AnimeFormat, AnimeStatus, PrismaClient, User } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { PrismaService } from '../common/prisma/prisma.service';
import { buildSearchText, sortTitleOf } from '../common/search/search-key';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { testDatabaseUrl } = require('../../test/database-url') as { testDatabaseUrl: () => string };

export function createTestPrisma() {
  // PrismaService only adds Nest lifecycle hooks to PrismaClient.
  return new PrismaClient({ datasourceUrl: testDatabaseUrl() }) as PrismaService;
}

export async function resetDatabase(prisma: PrismaClient) {
  const tables = await prisma.$queryRaw<Array<{ tablename: string }>>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  await prisma.$executeRawUnsafe(`TRUNCATE ${tables.map(({ tablename }) => `"${tablename}"`).join(', ')} RESTART IDENTITY CASCADE`);
}

// One shared hash keeps the suites fast; every test user's password is Password123!.
const PASSWORD_HASH = bcrypt.hashSync('Password123!', 4);

export async function createUser(prisma: PrismaClient, overrides: Partial<User> = {}) {
  const id = overrides.id ?? randomUUID();
  return prisma.user.create({
    data: {
      id,
      username: overrides.username ?? `user-${id.replace(/[^a-z0-9]/gi, '').slice(-12)}`,
      email: overrides.email ?? `${id.replace(/[^a-z0-9-]/gi, '').toLowerCase()}@example.com`,
      passwordHash: overrides.passwordHash ?? PASSWORD_HASH,
      role: overrides.role ?? 'user',
      isBanned: overrides.isBanned ?? false,
      bannedUntil: overrides.bannedUntil ?? null,
      failedLoginAttempts: overrides.failedLoginAttempts ?? 0,
      lockedUntil: overrides.lockedUntil ?? null,
      emailVerifiedAt: overrides.emailVerifiedAt === undefined ? new Date() : overrides.emailVerifiedAt,
    },
  });
}

export async function createAnime(
  prisma: PrismaClient,
  overrides: {
    id?: string;
    title?: string;
    alternativeTitles?: string[];
    hasDub?: boolean;
    popularity?: number | null;
    releaseYear?: number | null;
    status?: AnimeStatus;
    format?: AnimeFormat | null;
    genreNames?: string[];
  } = {},
) {
  const id = overrides.id ?? `test-${randomUUID().slice(0, 8)}`;
  const title = overrides.title ?? `Title ${id}`;
  const alternativeTitles = overrides.alternativeTitles ?? [];
  const genres = [];
  for (const name of overrides.genreNames ?? []) {
    genres.push(await prisma.genre.upsert({ where: { name }, create: { name }, update: {} }));
  }

  return prisma.anime.create({
    data: {
      id,
      title,
      sortTitle: sortTitleOf(title),
      searchText: buildSearchText(title, alternativeTitles),
      alternativeTitles,
      hasDub: overrides.hasDub ?? false,
      popularity: overrides.popularity ?? null,
      releaseYear: overrides.releaseYear === undefined ? 2013 : overrides.releaseYear,
      status: overrides.status ?? 'completed',
      format: overrides.format === undefined ? 'TV' : overrides.format,
      genres: { create: genres.map((genre) => ({ genreId: genre.id })) },
    },
  });
}
