// DataService is a lightweight replacement for the missing persistent database layer.
// It seeds realistic sample users, anime, ratings, comments, and admin logs so the
// frontend and API can be explored immediately without any external setup.
import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';

export type UserRole = 'user' | 'admin';
export type AnimeStatus = 'airing' | 'completed' | 'upcoming';

export interface GenreRecord {
  id: number;
  name: string;
}

export interface UserRecord {
  id: string;
  username: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  isBanned: boolean;
  banReason: string | null;
  bannedUntil: Date | null;
  failedLoginAttempts: number;
  lockedUntil: Date | null;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface AnimeRecord {
  id: string;
  title: string;
  description: string;
  coverImageUrl: string | null;
  releaseYear: number | null;
  hasDub: boolean;
  status: AnimeStatus;
  genres: GenreRecord[];
  createdAt: Date;
  updatedAt: Date;
}

export interface RatingRecord {
  id: string;
  userId: string;
  animeId: string;
  subRating: number | null;
  dubRating: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CommentRecord {
  id: string;
  userId: string;
  animeId: string;
  parentId: string | null;
  content: string;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CommentLikeRecord {
  commentId: string;
  userId: string;
  value: 1 | -1;
  createdAt: Date;
}

export interface RefreshTokenRecord {
  id: string;
  userId: string;
  tokenHash: string;
  ipAddress: string | null;
  userAgent: string | null;
  expiresAt: Date;
  revokedAt: Date | null;
  createdAt: Date;
}

export interface PasswordResetTokenRecord {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  usedAt: Date | null;
  createdAt: Date;
}

export interface AdminLogRecord {
  id: string;
  adminId: string;
  action: string;
  targetType: string | null;
  targetId: string | null;
  metadata: Record<string, unknown> | null;
  ipAddress: string | null;
  createdAt: Date;
}

@Injectable()
export class DataService {
  // These arrays act as the current persistence boundary for the demo runtime.
  readonly users: UserRecord[] = [];
  readonly anime: AnimeRecord[] = [];
  readonly ratings: RatingRecord[] = [];
  readonly comments: CommentRecord[] = [];
  readonly commentLikes: CommentLikeRecord[] = [];
  readonly refreshTokens: RefreshTokenRecord[] = [];
  readonly passwordResetTokens: PasswordResetTokenRecord[] = [];
  readonly adminLogs: AdminLogRecord[] = [];

  constructor() {
    this.seed();
  }

  findUserByEmail(email: string) {
    // Email lookup is case-insensitive because login forms usually are too.
    return this.users.find((user) => user.email.toLowerCase() === email.toLowerCase()) ?? null;
  }

  findUserByUsername(username: string) {
    return this.users.find((user) => user.username.toLowerCase() === username.toLowerCase()) ?? null;
  }

  findUserById(id: string) {
    return this.users.find((user) => user.id === id) ?? null;
  }

  findAnimeById(id: string) {
    return this.anime.find((entry) => entry.id === id) ?? null;
  }

  private seed() {
    if (this.users.length > 0) {
      return;
    }

    // Seed just enough realistic data to make every page feel populated on first boot.
    const now = new Date();
    const adminId = randomUUID();
    const demoId = randomUUID();
    const guestId = randomUUID();
    const passwordHash = bcrypt.hashSync('Password123!', 10);

    this.users.push(
      {
        id: adminId,
        username: 'admin',
        email: 'admin@example.com',
        passwordHash,
        role: 'admin',
        isBanned: false,
        banReason: null,
        bannedUntil: null,
        failedLoginAttempts: 0,
        lockedUntil: null,
        lastLoginAt: null,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: demoId,
        username: 'demo',
        email: 'demo@example.com',
        passwordHash,
        role: 'user',
        isBanned: false,
        banReason: null,
        bannedUntil: null,
        failedLoginAttempts: 0,
        lockedUntil: null,
        lastLoginAt: null,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: guestId,
        username: 'otaku',
        email: 'otaku@example.com',
        passwordHash,
        role: 'user',
        isBanned: false,
        banReason: null,
        bannedUntil: null,
        failedLoginAttempts: 0,
        lockedUntil: null,
        lastLoginAt: null,
        createdAt: now,
        updatedAt: now,
      },
    );

    const genres: GenreRecord[] = [
      { id: 1, name: 'Action' },
      { id: 2, name: 'Adventure' },
      { id: 3, name: 'Drama' },
      { id: 4, name: 'Fantasy' },
      { id: 5, name: 'Mystery' },
      { id: 6, name: 'Sci-Fi' },
    ];

    const animeOne = randomUUID();
    const animeTwo = randomUUID();
    const animeThree = randomUUID();
    const animeFour = randomUUID();
    const animeFive = randomUUID();
    const animeSix = randomUUID();

    this.anime.push(
      {
        id: animeOne,
        title: 'Skyline Ronin',
        description: 'A lone swordsman protects a floating city where every duel shifts the balance of power.',
        coverImageUrl: null,
        releaseYear: 2024,
        hasDub: true,
        status: 'airing',
        genres: [genres[0], genres[1]],
        createdAt: now,
        updatedAt: now,
      },
      {
        id: animeTwo,
        title: 'Neon Tide',
        description: 'Teen pilots dive into a flooded megacity to recover memories from the ocean floor.',
        coverImageUrl: null,
        releaseYear: 2023,
        hasDub: true,
        status: 'completed',
        genres: [genres[0], genres[5]],
        createdAt: now,
        updatedAt: now,
      },
      {
        id: animeThree,
        title: 'Paper Lantern Winter',
        description: 'A quiet mountain town hides a centuries-old pact between shrine keepers and wandering spirits.',
        coverImageUrl: null,
        releaseYear: 2022,
        hasDub: false,
        status: 'completed',
        genres: [genres[2], genres[3]],
        createdAt: now,
        updatedAt: now,
      },
      {
        id: animeFour,
        title: 'Signal Bloom',
        description: 'A hacker collective discovers that abandoned radio towers can rewrite probability.',
        coverImageUrl: null,
        releaseYear: 2025,
        hasDub: true,
        status: 'upcoming',
        genres: [genres[4], genres[5]],
        createdAt: now,
        updatedAt: now,
      },
      {
        id: animeFive,
        title: 'Crimson Relay',
        description: 'Courier racers navigate a divided capital where every delivery could trigger open war.',
        coverImageUrl: null,
        releaseYear: 2021,
        hasDub: true,
        status: 'completed',
        genres: [genres[0], genres[2]],
        createdAt: now,
        updatedAt: now,
      },
      {
        id: animeSix,
        title: 'Moonlit Atelier',
        description: 'An art student paints visions of futures that refuse to stay on the canvas.',
        coverImageUrl: null,
        releaseYear: 2020,
        hasDub: false,
        status: 'completed',
        genres: [genres[2], genres[4]],
        createdAt: now,
        updatedAt: now,
      },
    );

    // Ratings intentionally cover mixed sub/dub cases so the detail page can compare both.
    this.ratings.push(
      {
        id: randomUUID(),
        userId: demoId,
        animeId: animeOne,
        subRating: 5,
        dubRating: 4,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: randomUUID(),
        userId: guestId,
        animeId: animeOne,
        subRating: 4,
        dubRating: 4,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: randomUUID(),
        userId: demoId,
        animeId: animeTwo,
        subRating: 4,
        dubRating: 5,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: randomUUID(),
        userId: guestId,
        animeId: animeThree,
        subRating: 5,
        dubRating: null,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: randomUUID(),
        userId: adminId,
        animeId: animeFive,
        subRating: 4,
        dubRating: 3,
        createdAt: now,
        updatedAt: now,
      },
    );

    // A small threaded comment sample is enough to exercise nesting and moderation paths.
    const firstCommentId = randomUUID();
    this.comments.push(
      {
        id: firstCommentId,
        userId: demoId,
        animeId: animeOne,
        parentId: null,
        content: 'The soundtrack absolutely sells the aerial duels.',
        isDeleted: false,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: randomUUID(),
        userId: guestId,
        animeId: animeOne,
        parentId: firstCommentId,
        content: 'Agreed. Episode 3 had a ridiculous final sequence.',
        isDeleted: false,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: randomUUID(),
        userId: adminId,
        animeId: animeTwo,
        parentId: null,
        content: 'Dub direction is much stronger than I expected here.',
        isDeleted: false,
        createdAt: now,
        updatedAt: now,
      },
    );

    this.commentLikes.push(
      { commentId: firstCommentId, userId: adminId, value: 1, createdAt: now },
      { commentId: firstCommentId, userId: guestId, value: 1, createdAt: now },
    );
  }
}
