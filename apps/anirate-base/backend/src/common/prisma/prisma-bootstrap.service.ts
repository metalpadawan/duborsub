// PrismaBootstrapService seeds development data into an empty Postgres database
// so the app can still boot with demo accounts and sample anime after `db push`.
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { refreshAnimeStats } from './anime-stats';
import { PrismaService } from './prisma.service';

@Injectable()
export class PrismaBootstrapService implements OnModuleInit {
  private readonly logger = new Logger(PrismaBootstrapService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async onModuleInit() {
    try {
      await this.seedIfNeeded();
    } catch (error) {
      const message = (error as Error).message;
      throw new Error(
        `PostgreSQL is not ready for AniRate. Run "npm run db:push" from the repo root, then restart the backend. Original error: ${message}`,
      );
    }
  }

  private async seedIfNeeded() {
    if (this.config.get('NODE_ENV', 'development') === 'production') {
      return;
    }

    const existingUsers = await this.prisma.user.count();
    if (existingUsers > 0) {
      return;
    }

    const passwordHash = await bcrypt.hash('Password123!', 10);
    const genreNames = ['Action', 'Adventure', 'Drama', 'Fantasy', 'Mystery', 'Sci-Fi'];

    await this.prisma.genre.createMany({
      data: genreNames.map((name) => ({ name })),
      skipDuplicates: true,
    });

    const genres = await this.prisma.genre.findMany();
    const genresByName = new Map(genres.map((genre) => [genre.name, genre.id]));

    const admin = await this.prisma.user.create({
      data: {
        id: randomUUID(),
        username: 'admin',
        email: 'admin@example.com',
        passwordHash,
        role: 'admin',
      },
    });

    const demo = await this.prisma.user.create({
      data: {
        id: randomUUID(),
        username: 'demo',
        email: 'demo@example.com',
        passwordHash,
        role: 'user',
      },
    });

    const guest = await this.prisma.user.create({
      data: {
        id: randomUUID(),
        username: 'otaku',
        email: 'otaku@example.com',
        passwordHash,
        role: 'user',
      },
    });

    const animeEntries = [
      {
        id: randomUUID(),
        title: 'Skyline Ronin',
        description: 'A lone swordsman protects a floating city where every duel shifts the balance of power.',
        releaseYear: 2024,
        hasDub: true,
        status: 'airing',
        genres: ['Action', 'Adventure'],
      },
      {
        id: randomUUID(),
        title: 'Neon Tide',
        description: 'Teen pilots dive into a flooded megacity to recover memories from the ocean floor.',
        releaseYear: 2023,
        hasDub: true,
        status: 'completed',
        genres: ['Action', 'Sci-Fi'],
      },
      {
        id: randomUUID(),
        title: 'Paper Lantern Winter',
        description: 'A quiet mountain town hides a centuries-old pact between shrine keepers and wandering spirits.',
        releaseYear: 2022,
        hasDub: false,
        status: 'completed',
        genres: ['Drama', 'Fantasy'],
      },
      {
        id: randomUUID(),
        title: 'Signal Bloom',
        description: 'A hacker collective discovers that abandoned radio towers can rewrite probability.',
        releaseYear: 2025,
        hasDub: true,
        status: 'upcoming',
        genres: ['Mystery', 'Sci-Fi'],
      },
      {
        id: randomUUID(),
        title: 'Crimson Relay',
        description: 'Courier racers navigate a divided capital where every delivery could trigger open war.',
        releaseYear: 2021,
        hasDub: true,
        status: 'completed',
        genres: ['Action', 'Drama'],
      },
      {
        id: randomUUID(),
        title: 'Moonlit Atelier',
        description: 'An art student paints visions of futures that refuse to stay on the canvas.',
        releaseYear: 2020,
        hasDub: false,
        status: 'completed',
        genres: ['Drama', 'Mystery'],
      },
    ];

    for (const entry of animeEntries) {
      await this.prisma.anime.create({
        data: {
          id: entry.id,
          title: entry.title,
          description: entry.description,
          releaseYear: entry.releaseYear,
          hasDub: entry.hasDub,
          status: entry.status,
          animeGenres: {
            create: entry.genres.map((genreName) => ({
              genre: {
                connect: {
                  id: genresByName.get(genreName)!,
                },
              },
            })),
          },
        },
      });
    }

    await this.prisma.rating.createMany({
      data: [
        {
          id: randomUUID(),
          userId: demo.id,
          animeId: animeEntries[0].id,
          subRating: 5,
          dubRating: 4,
        },
        {
          id: randomUUID(),
          userId: guest.id,
          animeId: animeEntries[0].id,
          subRating: 4,
          dubRating: 4,
        },
        {
          id: randomUUID(),
          userId: demo.id,
          animeId: animeEntries[1].id,
          subRating: 4,
          dubRating: 5,
        },
        {
          id: randomUUID(),
          userId: guest.id,
          animeId: animeEntries[2].id,
          subRating: 5,
          dubRating: null,
        },
        {
          id: randomUUID(),
          userId: admin.id,
          animeId: animeEntries[4].id,
          subRating: 4,
          dubRating: 3,
        },
      ],
    });

    const firstCommentId = randomUUID();

    await this.prisma.comment.create({
      data: {
        id: firstCommentId,
        userId: demo.id,
        animeId: animeEntries[0].id,
        content: 'The soundtrack absolutely sells the aerial duels.',
      },
    });

    await this.prisma.comment.create({
      data: {
        id: randomUUID(),
        userId: guest.id,
        animeId: animeEntries[0].id,
        parentId: firstCommentId,
        content: 'Agreed. Episode 3 had a ridiculous final sequence.',
      },
    });

    await this.prisma.comment.create({
      data: {
        id: randomUUID(),
        userId: admin.id,
        animeId: animeEntries[1].id,
        content: 'Dub direction is much stronger than I expected here.',
      },
    });

    await this.prisma.commentLike.createMany({
      data: [
        { commentId: firstCommentId, userId: admin.id, value: 1 },
        { commentId: firstCommentId, userId: guest.id, value: 1 },
      ],
    });

    await Promise.all(animeEntries.map((anime) => refreshAnimeStats(this.prisma, anime.id)));
    this.logger.log('Seeded development demo data into PostgreSQL.');
  }
}
