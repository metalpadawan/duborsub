// DataService is the current persistence boundary for the local AniRate runtime.
// It seeds realistic sample data on first boot, then saves all later mutations to
// a JSON datastore on disk so the app survives restarts without extra setup.
import { Injectable, Logger } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'fs';
import { dirname, resolve } from 'path';
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

interface PersistedSnapshot {
  genres?: GenreRecord[];
  users?: Array<Omit<UserRecord, 'bannedUntil' | 'lockedUntil' | 'lastLoginAt' | 'createdAt' | 'updatedAt'> & {
    bannedUntil: string | Date | null;
    lockedUntil: string | Date | null;
    lastLoginAt: string | Date | null;
    createdAt: string | Date;
    updatedAt: string | Date;
  }>;
  anime?: Array<Omit<AnimeRecord, 'createdAt' | 'updatedAt'> & {
    createdAt: string | Date;
    updatedAt: string | Date;
  }>;
  ratings?: Array<Omit<RatingRecord, 'createdAt' | 'updatedAt'> & {
    createdAt: string | Date;
    updatedAt: string | Date;
  }>;
  comments?: Array<Omit<CommentRecord, 'createdAt' | 'updatedAt'> & {
    createdAt: string | Date;
    updatedAt: string | Date;
  }>;
  commentLikes?: Array<Omit<CommentLikeRecord, 'createdAt'> & {
    createdAt: string | Date;
  }>;
  refreshTokens?: Array<Omit<RefreshTokenRecord, 'expiresAt' | 'revokedAt' | 'createdAt'> & {
    expiresAt: string | Date;
    revokedAt: string | Date | null;
    createdAt: string | Date;
  }>;
  passwordResetTokens?: Array<Omit<PasswordResetTokenRecord, 'expiresAt' | 'usedAt' | 'createdAt'> & {
    expiresAt: string | Date;
    usedAt: string | Date | null;
    createdAt: string | Date;
  }>;
  adminLogs?: Array<Omit<AdminLogRecord, 'createdAt'> & {
    createdAt: string | Date;
  }>;
}

const DATA_FILE = resolve(__dirname, '..', '..', '.data', 'anirate-db.json');

@Injectable()
export class DataService {
  private readonly logger = new Logger(DataService.name);
  private readonly storagePath = DATA_FILE;

  // These arrays are still the in-process working set, but they are now backed by
  // a datastore file instead of disappearing whenever the server restarts.
  readonly genres: GenreRecord[] = [];
  readonly users: UserRecord[] = [];
  readonly anime: AnimeRecord[] = [];
  readonly ratings: RatingRecord[] = [];
  readonly comments: CommentRecord[] = [];
  readonly commentLikes: CommentLikeRecord[] = [];
  readonly refreshTokens: RefreshTokenRecord[] = [];
  readonly passwordResetTokens: PasswordResetTokenRecord[] = [];
  readonly adminLogs: AdminLogRecord[] = [];

  constructor() {
    this.loadOrSeed();
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

  save() {
    // Saving uses an atomic rename so a partial write does not corrupt the datastore.
    mkdirSync(dirname(this.storagePath), { recursive: true });
    const tempFile = `${this.storagePath}.tmp`;
    writeFileSync(tempFile, JSON.stringify(this.snapshot(), null, 2), 'utf8');
    renameSync(tempFile, this.storagePath);
  }

  private loadOrSeed() {
    if (this.loadFromDisk()) {
      return;
    }

    this.seed();
    this.save();
  }

  private loadFromDisk() {
    if (!existsSync(this.storagePath)) {
      return false;
    }

    try {
      const raw = readFileSync(this.storagePath, 'utf8');
      const snapshot = JSON.parse(raw) as PersistedSnapshot;
      this.applySnapshot(snapshot);
      return true;
    } catch (error) {
      this.logger.warn(`Failed to read persisted datastore, reseeding local data. ${(error as Error).message}`);
      this.clearAll();
      return false;
    }
  }

  private snapshot(): PersistedSnapshot {
    return {
      genres: this.genres,
      users: this.users,
      anime: this.anime,
      ratings: this.ratings,
      comments: this.comments,
      commentLikes: this.commentLikes,
      refreshTokens: this.refreshTokens,
      passwordResetTokens: this.passwordResetTokens,
      adminLogs: this.adminLogs,
    };
  }

  private applySnapshot(snapshot: PersistedSnapshot) {
    this.clearAll();

    const genres = snapshot.genres?.length
      ? snapshot.genres
      : this.collectGenres(snapshot.anime ?? []);

    this.genres.push(...genres);
    this.users.push(
      ...(snapshot.users ?? []).map((user) => ({
        ...user,
        bannedUntil: this.toDate(user.bannedUntil),
        lockedUntil: this.toDate(user.lockedUntil),
        lastLoginAt: this.toDate(user.lastLoginAt),
        createdAt: this.toDate(user.createdAt),
        updatedAt: this.toDate(user.updatedAt),
      })),
    );
    this.anime.push(
      ...(snapshot.anime ?? []).map((anime) => ({
        ...anime,
        genres: anime.genres ?? [],
        createdAt: this.toDate(anime.createdAt),
        updatedAt: this.toDate(anime.updatedAt),
      })),
    );
    this.ratings.push(
      ...(snapshot.ratings ?? []).map((rating) => ({
        ...rating,
        createdAt: this.toDate(rating.createdAt),
        updatedAt: this.toDate(rating.updatedAt),
      })),
    );
    this.comments.push(
      ...(snapshot.comments ?? []).map((comment) => ({
        ...comment,
        createdAt: this.toDate(comment.createdAt),
        updatedAt: this.toDate(comment.updatedAt),
      })),
    );
    this.commentLikes.push(
      ...(snapshot.commentLikes ?? []).map((like) => ({
        ...like,
        createdAt: this.toDate(like.createdAt),
      })),
    );
    this.refreshTokens.push(
      ...(snapshot.refreshTokens ?? []).map((token) => ({
        ...token,
        expiresAt: this.toDate(token.expiresAt),
        revokedAt: this.toDate(token.revokedAt),
        createdAt: this.toDate(token.createdAt),
      })),
    );
    this.passwordResetTokens.push(
      ...(snapshot.passwordResetTokens ?? []).map((token) => ({
        ...token,
        expiresAt: this.toDate(token.expiresAt),
        usedAt: this.toDate(token.usedAt),
        createdAt: this.toDate(token.createdAt),
      })),
    );
    this.adminLogs.push(
      ...(snapshot.adminLogs ?? []).map((log) => ({
        ...log,
        createdAt: this.toDate(log.createdAt),
      })),
    );
  }

  private clearAll() {
    this.genres.length = 0;
    this.users.length = 0;
    this.anime.length = 0;
    this.ratings.length = 0;
    this.comments.length = 0;
    this.commentLikes.length = 0;
    this.refreshTokens.length = 0;
    this.passwordResetTokens.length = 0;
    this.adminLogs.length = 0;
  }

  private collectGenres(animeRecords: Array<{ genres?: GenreRecord[] }>) {
    const unique = new Map<number, GenreRecord>();

    animeRecords.forEach((anime) => {
      anime.genres?.forEach((genre) => {
        unique.set(genre.id, genre);
      });
    });

    return Array.from(unique.values()).sort((left, right) => left.id - right.id);
  }

  private toDate(value: string | Date | null) {
    return value ? new Date(value) : null;
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

    const genres: GenreRecord[] = [
      { id: 1, name: 'Action' },
      { id: 2, name: 'Adventure' },
      { id: 3, name: 'Drama' },
      { id: 4, name: 'Fantasy' },
      { id: 5, name: 'Mystery' },
      { id: 6, name: 'Sci-Fi' },
    ];

    this.genres.push(...genres);

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
