// SeedService gives an empty database enough to boot into: the genre list always,
// demo accounts and six sample titles in development, and in production only an
// admin whose credentials come from the environment.
import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { buildSearchText, sortTitleOf } from '../search/search-key';
import { refreshAnimeStats } from './anime-stats';
import { PrismaService } from './prisma.service';

// AniList's genre set; imports map their tags onto these.
export const GENRES = [
  'Action',
  'Adventure',
  'Comedy',
  'Drama',
  'Ecchi',
  'Fantasy',
  'Horror',
  'Mahou Shoujo',
  'Mecha',
  'Music',
  'Mystery',
  'Psychological',
  'Romance',
  'Sci-Fi',
  'Slice of Life',
  'Sports',
  'Supernatural',
  'Thriller',
];

// Fixed ids, so the catalogue import can recognise and remove the samples.
export const SAMPLE_ANIME = [
  {
    id: 'ff0c8c69-b21f-4dfa-a22b-1bfba63c20e3',
    title: 'Skyline Ronin',
    description: 'A lone swordsman protects a floating city where every duel shifts the balance of power.',
    releaseYear: 2024,
    hasDub: true,
    status: 'airing',
    genres: ['Action', 'Adventure'],
  },
  {
    id: '00955f2a-9ded-443c-ae93-6eb7e6e987ec',
    title: 'Neon Tide',
    description: 'Teen pilots dive into a flooded megacity to recover memories from the ocean floor.',
    releaseYear: 2023,
    hasDub: true,
    status: 'completed',
    genres: ['Action', 'Sci-Fi'],
  },
  {
    id: 'ce094da3-7f20-4b11-aa7e-d9540691520d',
    title: 'Paper Lantern Winter',
    description: 'A quiet mountain town hides a centuries-old pact between shrine keepers and wandering spirits.',
    releaseYear: 2022,
    hasDub: false,
    status: 'completed',
    genres: ['Drama', 'Fantasy'],
  },
  {
    id: '665c3d83-1862-4d22-bd19-a3a69c3720f5',
    title: 'Signal Bloom',
    description: 'A hacker collective discovers that abandoned radio towers can rewrite probability.',
    releaseYear: 2025,
    hasDub: true,
    status: 'upcoming',
    genres: ['Mystery', 'Sci-Fi'],
  },
  {
    id: 'aeae9dd3-554e-47bf-9bb7-297566662dd1',
    title: 'Crimson Relay',
    description: 'Courier racers navigate a divided capital where every delivery could trigger open war.',
    releaseYear: 2021,
    hasDub: true,
    status: 'completed',
    genres: ['Action', 'Drama'],
  },
  {
    id: 'a9a18938-2963-46ba-ae87-6bfabdd1ecb8',
    title: 'Moonlit Atelier',
    description: 'An art student paints visions of futures that refuse to stay on the canvas.',
    releaseYear: 2020,
    hasDub: false,
    status: 'completed',
    genres: ['Drama', 'Mystery'],
  },
] as const;

const DEMO_USERS = [
  { id: 'seed-user-admin', username: 'admin', email: 'admin@example.com', role: 'admin' },
  { id: 'seed-user-demo', username: 'demo', email: 'demo@example.com', role: 'user' },
  { id: 'seed-user-otaku', username: 'otaku', email: 'otaku@example.com', role: 'user' },
] as const;

@Injectable()
export class SeedService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SeedService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async onApplicationBootstrap() {
    await this.seed();
  }

  async seed() {
    await this.prisma.genre.createMany({ data: GENRES.map((name) => ({ name })), skipDuplicates: true });

    if ((await this.prisma.user.count()) > 0) {
      return;
    }

    if (this.config.get<string>('NODE_ENV') === 'production') {
      // Production never gets the demo accounts and their published password.
      await this.seedProductionAdmin();
      return;
    }

    const passwordHash = await bcrypt.hash('Password123!', 10);
    await this.prisma.user.createMany({
      data: DEMO_USERS.map((user) => ({ ...user, passwordHash })),
    });

    if ((await this.prisma.anime.count()) === 0) {
      await this.seedSampleCatalogue();
    }
  }

  // Just enough to make every page feel populated before a catalogue is imported.
  private async seedSampleCatalogue() {
    const genres = new Map((await this.prisma.genre.findMany()).map((genre) => [genre.name, genre.id]));

    for (const sample of SAMPLE_ANIME) {
      await this.prisma.anime.create({
        data: {
          id: sample.id,
          title: sample.title,
          sortTitle: sortTitleOf(sample.title),
          searchText: buildSearchText(sample.title, []),
          description: sample.description,
          releaseYear: sample.releaseYear,
          hasDub: sample.hasDub,
          status: sample.status,
          format: 'TV',
          genres: { create: sample.genres.map((name) => ({ genreId: genres.get(name) as number })) },
        },
      });
    }

    // Mixed sub/dub cases, so the detail page has comparisons to show.
    const [skyline, neon, paper, , crimson] = SAMPLE_ANIME.map((sample) => sample.id);
    const ratings: Array<[string, string, number | null, number | null]> = [
      ['seed-user-demo', skyline, 5, 4],
      ['seed-user-otaku', skyline, 4, 4],
      ['seed-user-demo', neon, 4, 5],
      ['seed-user-otaku', paper, 5, null],
      ['seed-user-admin', crimson, 4, 3],
    ];
    await this.prisma.rating.createMany({
      data: ratings.map(([userId, animeId, subRating, dubRating]) => ({ id: randomUUID(), userId, animeId, subRating, dubRating })),
    });
    for (const animeId of new Set(ratings.map(([, animeId]) => animeId))) {
      await this.prisma.$transaction((tx) => refreshAnimeStats(tx, animeId));
    }

    // A small thread exercises nesting and moderation.
    const firstCommentId = randomUUID();
    await this.prisma.comment.create({
      data: { id: firstCommentId, userId: 'seed-user-demo', animeId: skyline, content: 'The soundtrack absolutely sells the aerial duels.' },
    });
    await this.prisma.comment.createMany({
      data: [
        { id: randomUUID(), userId: 'seed-user-otaku', animeId: skyline, parentId: firstCommentId, content: 'Agreed. Episode 3 had a ridiculous final sequence.' },
        { id: randomUUID(), userId: 'seed-user-admin', animeId: neon, content: 'Dub direction is much stronger than I expected here.' },
      ],
    });
    await this.prisma.commentLike.createMany({
      data: [
        { commentId: firstCommentId, userId: 'seed-user-admin', value: 1 },
        { commentId: firstCommentId, userId: 'seed-user-otaku', value: 1 },
      ],
    });
  }

  private async seedProductionAdmin() {
    const email = this.config.get<string>('SEED_ADMIN_EMAIL');
    const password = this.config.get<string>('SEED_ADMIN_PASSWORD');

    if (!email || !password) {
      this.logger.warn(
        'Production database has no accounts. Set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD to create the first admin.',
      );
      return;
    }

    await this.prisma.user.create({
      data: {
        id: randomUUID(),
        username: 'admin',
        email: email.toLowerCase(),
        passwordHash: await bcrypt.hash(password, 12),
        role: 'admin',
      },
    });
  }
}
