// These helpers keep anime aggregate ratings consistent whenever a rating changes.
// Prisma `db push` does not recreate the SQL triggers from the archived schema file,
// so the application recalculates the summary columns directly.
import { PrismaService } from './prisma.service';

export async function refreshAnimeStats(prisma: PrismaService, animeId: string) {
  const ratings = await prisma.rating.findMany({
    where: { animeId },
    select: {
      subRating: true,
      dubRating: true,
    },
  });

  const subRatings = ratings
    .map((rating) => rating.subRating)
    .filter((value): value is number => value !== null);
  const dubRatings = ratings
    .map((rating) => rating.dubRating)
    .filter((value): value is number => value !== null);

  await prisma.anime.update({
    where: { id: animeId },
    data: {
      avgSubRating: average(subRatings),
      avgDubRating: average(dubRatings),
      totalVotes: ratings.length,
    },
  });
}

function average(values: number[]) {
  if (values.length === 0) {
    return null;
  }

  const total = values.reduce((sum, value) => sum + value, 0);
  return Number((total / values.length).toFixed(2));
}
