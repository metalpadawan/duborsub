// Rating totals live on the anime row so lists can sort by them in SQL. They are
// recomputed from the ratings table inside the same transaction as every rating
// change, with the anime row locked so two simultaneous ratings cannot both write
// totals that miss the other.
import { Prisma, PrismaClient } from '@prisma/client';

// The lock comes before the rating write: inserting a rating takes a shared lock on
// the anime row through its foreign key, and upgrading that afterwards deadlocks
// against a second rating doing the same.
function lockAnime(tx: Prisma.TransactionClient, animeId: string) {
  return tx.$queryRaw`SELECT id FROM anime WHERE id = ${animeId} FOR UPDATE`;
}

export async function refreshAnimeStats(tx: Prisma.TransactionClient, animeId: string) {
  await lockAnime(tx, animeId);

  const totals = await tx.rating.aggregate({
    where: { animeId },
    _sum: { subRating: true, dubRating: true },
    _count: { subRating: true, dubRating: true, _all: true },
  });

  const subSum = totals._sum.subRating ?? 0;
  const dubSum = totals._sum.dubRating ?? 0;
  const subCount = totals._count.subRating;
  const dubCount = totals._count.dubRating;
  const avgSubRating = average(subSum, subCount);
  const avgDubRating = average(dubSum, dubCount);

  await tx.anime.update({
    where: { id: animeId },
    data: {
      subSum,
      subCount,
      dubSum,
      dubCount,
      totalVotes: totals._count._all,
      avgSubRating,
      avgDubRating,
      bestRating: avgSubRating === null && avgDubRating === null ? null : Math.max(avgSubRating ?? 0, avgDubRating ?? 0),
    },
  });
}

/** Runs a rating change and the recount in one transaction. */
export function withAnimeStats<T>(
  prisma: PrismaClient,
  animeId: string,
  change: (tx: Prisma.TransactionClient) => Promise<T>,
) {
  return prisma.$transaction(async (tx) => {
    await lockAnime(tx, animeId);
    const result = await change(tx);
    await refreshAnimeStats(tx, animeId);
    return result;
  });
}

function average(sum: number, count: number) {
  return count === 0 ? null : Number((sum / count).toFixed(2));
}
