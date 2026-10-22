// One-off move from the old file datastore (.data/anirate-db.json and
// anirate-db.catalog.json) into PostgreSQL: accounts, sessions, ratings, notes, dub
// reports, admin history and the whole catalogue, with ids kept.
//
//   node scripts/migrate-json-to-postgres.mjs [--data-file <anirate-db.json>] [--replace]
//
// It refuses to write into a database that already has accounts or titles unless
// --replace is passed, which empties every table first.
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildSearchText, CATALOG_EXPORT_DIR, chunks, connect, parseArgs, sortTitleOf } from './lib/db.mjs';

const args = parseArgs(process.argv.slice(2));
const dataFile = resolve(String(args['data-file'] ?? resolve(CATALOG_EXPORT_DIR, '..', 'anirate-db.json')));
const catalogFile = dataFile.replace(/(\.json)?$/i, '.catalog.json');

process.exitCode = await main();

async function main() {
  if (!existsSync(dataFile)) {
    console.error(`No file datastore at ${dataFile}; nothing to migrate.`);
    return 1;
  }

  const snapshot = JSON.parse(readFileSync(dataFile, 'utf8'));
  // Older datastores keep the catalogue inline in the main file.
  const catalog = existsSync(catalogFile) ? JSON.parse(readFileSync(catalogFile, 'utf8')) : snapshot;
  const prisma = connect();
  const started = Date.now();

  try {
    const occupied = (await prisma.user.count()) + (await prisma.anime.count());
    if (occupied > 0 && !args.replace) {
      console.error('The database already has accounts or titles. Pass --replace to empty it and migrate anyway.');
      return 1;
    }

    if (args.replace) {
      const tables = await prisma.$queryRaw`SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
      await prisma.$executeRawUnsafe(`TRUNCATE ${tables.map(({ tablename }) => `"${tablename}"`).join(', ')} RESTART IDENTITY CASCADE`);
    }

    const date = (value) => (value ? new Date(value) : null);
    const anime = catalog.anime ?? [];
    const genreNames = [...new Set([...(catalog.genres ?? []).map((genre) => genre.name), ...anime.flatMap((entry) => (entry.genres ?? []).map((genre) => genre.name))])];
    await prisma.genre.createMany({ data: genreNames.map((name) => ({ name })), skipDuplicates: true });
    const genreIds = new Map((await prisma.genre.findMany()).map((genre) => [genre.name, genre.id]));

    await prisma.user.createMany({
      data: (snapshot.users ?? []).map((user) => ({
        id: user.id,
        username: user.username,
        email: user.email.toLowerCase(),
        passwordHash: user.passwordHash,
        role: user.role,
        isBanned: user.isBanned,
        banReason: user.banReason,
        bannedUntil: date(user.bannedUntil),
        failedLoginAttempts: user.failedLoginAttempts ?? 0,
        lockedUntil: date(user.lockedUntil),
        lastLoginAt: date(user.lastLoginAt),
        createdAt: date(user.createdAt) ?? new Date(),
        updatedAt: date(user.updatedAt) ?? new Date(),
      })),
    });

    for (const batch of chunks(anime, 1000)) {
      await prisma.anime.createMany({
        data: batch.map((entry) => ({
          id: entry.id,
          title: entry.title,
          sortTitle: sortTitleOf(entry.title),
          searchText: buildSearchText(entry.title, entry.alternativeTitles ?? []),
          description: entry.description ?? '',
          coverImageUrl: entry.coverImageUrl ?? null,
          releaseYear: entry.releaseYear ?? null,
          hasDub: Boolean(entry.hasDub),
          status: entry.status,
          format: entry.format ?? null,
          episodes: entry.episodes ?? null,
          alternativeTitles: entry.alternativeTitles ?? [],
          externalIds: entry.externalIds ?? {},
          popularity: entry.popularity ?? null,
          createdAt: date(entry.createdAt) ?? new Date(),
          updatedAt: date(entry.updatedAt) ?? new Date(),
        })),
      });
    }

    const links = anime.flatMap((entry) => (entry.genres ?? []).map((genre) => ({ animeId: entry.id, genreId: genreIds.get(genre.name) })));
    for (const batch of chunks(links, 5000)) {
      await prisma.animeGenre.createMany({ data: batch, skipDuplicates: true });
    }

    const animeIds = new Set(anime.map((entry) => entry.id));
    const userIds = new Set((snapshot.users ?? []).map((user) => user.id));
    const belongs = (row) => animeIds.has(row.animeId) && userIds.has(row.userId);

    const ratings = (snapshot.ratings ?? []).filter(belongs);
    await prisma.rating.createMany({
      data: ratings.map((rating) => ({
        id: rating.id,
        userId: rating.userId,
        animeId: rating.animeId,
        subRating: rating.subRating,
        dubRating: rating.dubRating,
        createdAt: date(rating.createdAt) ?? new Date(),
        updatedAt: date(rating.updatedAt) ?? new Date(),
      })),
    });
    await recountRatings(prisma, [...new Set(ratings.map((rating) => rating.animeId))]);

    // Top-level notes before replies, so every reply's parent exists.
    const comments = (snapshot.comments ?? []).filter(belongs).sort((left, right) => Number(Boolean(left.parentId)) - Number(Boolean(right.parentId)));
    await prisma.comment.createMany({
      data: comments.map((comment) => ({
        id: comment.id,
        userId: comment.userId,
        animeId: comment.animeId,
        parentId: comment.parentId,
        content: comment.content,
        isDeleted: comment.isDeleted,
        createdAt: date(comment.createdAt) ?? new Date(),
        updatedAt: date(comment.updatedAt) ?? new Date(),
      })),
    });
    const commentIds = new Set(comments.map((comment) => comment.id));

    await prisma.commentLike.createMany({
      data: (snapshot.commentLikes ?? [])
        .filter((like) => commentIds.has(like.commentId) && userIds.has(like.userId))
        .map((like) => ({ commentId: like.commentId, userId: like.userId, value: like.value, createdAt: date(like.createdAt) ?? new Date() })),
      skipDuplicates: true,
    });
    await prisma.dubReport.createMany({
      data: (snapshot.dubReports ?? []).filter(belongs).map((report) => ({ id: report.id, animeId: report.animeId, userId: report.userId, createdAt: date(report.createdAt) ?? new Date() })),
      skipDuplicates: true,
    });
    // Sessions come across too, so nobody is signed out by the move.
    await prisma.refreshToken.createMany({
      data: (snapshot.refreshTokens ?? []).filter((token) => userIds.has(token.userId)).map((token) => ({
        id: token.id,
        userId: token.userId,
        tokenHash: token.tokenHash,
        ipAddress: token.ipAddress,
        userAgent: token.userAgent,
        expiresAt: date(token.expiresAt),
        revokedAt: date(token.revokedAt),
        replacedByTokenId: token.replacedByTokenId ?? null,
        createdAt: date(token.createdAt) ?? new Date(),
      })),
      skipDuplicates: true,
    });
    await prisma.passwordResetToken.createMany({
      data: (snapshot.passwordResetTokens ?? []).filter((token) => userIds.has(token.userId)).map((token) => ({
        id: token.id,
        userId: token.userId,
        tokenHash: token.tokenHash,
        expiresAt: date(token.expiresAt),
        usedAt: date(token.usedAt),
        createdAt: date(token.createdAt) ?? new Date(),
      })),
      skipDuplicates: true,
    });
    await prisma.adminLog.createMany({
      data: (snapshot.adminLogs ?? []).filter((log) => userIds.has(log.adminId)).map((log) => ({
        id: log.id,
        adminId: log.adminId,
        action: log.action,
        targetType: log.targetType,
        targetId: log.targetId,
        metadata: log.metadata ?? undefined,
        ipAddress: log.ipAddress,
        createdAt: date(log.createdAt) ?? new Date(),
      })),
    });

    console.log(
      `Migrated ${userIds.size} accounts, ${anime.length} titles, ${ratings.length} ratings, ${comments.length} notes in ${Math.round((Date.now() - started) / 1000)}s.`,
    );
    console.log(`The JSON files are untouched; delete ${dataFile} and its .catalog.json when you no longer need them.`);
    return 0;
  } finally {
    await prisma.$disconnect();
  }
}

// The same totals as the backend's anime-stats.ts, computed once per rated title.
async function recountRatings(prisma, animeIds) {
  for (const animeId of animeIds) {
    const totals = await prisma.rating.aggregate({
      where: { animeId },
      _sum: { subRating: true, dubRating: true },
      _count: { subRating: true, dubRating: true, _all: true },
    });
    const average = (sum, count) => (count ? Number((sum / count).toFixed(2)) : null);
    const avgSubRating = average(totals._sum.subRating ?? 0, totals._count.subRating);
    const avgDubRating = average(totals._sum.dubRating ?? 0, totals._count.dubRating);
    await prisma.anime.update({
      where: { id: animeId },
      data: {
        subSum: totals._sum.subRating ?? 0,
        subCount: totals._count.subRating,
        dubSum: totals._sum.dubRating ?? 0,
        dubCount: totals._count.dubRating,
        totalVotes: totals._count._all,
        avgSubRating,
        avgDubRating,
        bestRating: avgSubRating === null && avgDubRating === null ? null : Math.max(avgSubRating ?? 0, avgDubRating ?? 0),
      },
    });
  }
}
