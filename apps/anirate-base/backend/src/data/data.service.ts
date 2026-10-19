// DataService is the current persistence boundary for the local AniRate runtime.
// It seeds realistic sample data on first boot, then saves all later mutations to
// a JSON datastore on disk so the app survives restarts without extra setup.
import { Injectable, Logger, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'fs';
import { rename, writeFile } from 'fs/promises';
import { dirname, resolve } from 'path';
import { randomUUID } from 'crypto';
import { removeWhere } from '../common/collections/remove-where';

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
  // Set when the token was revoked by normal rotation, so a near-simultaneous
  // second refresh can be told apart from a stolen token being replayed.
  replacedByTokenId: string | null;
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
  refreshTokens?: Array<Omit<RefreshTokenRecord, 'expiresAt' | 'revokedAt' | 'replacedByTokenId' | 'createdAt'> & {
    expiresAt: string | Date;
    revokedAt: string | Date | null;
    replacedByTokenId?: string | null;
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

const DEFAULT_DATA_FILE = resolve(__dirname, '..', '..', '.data', 'anirate-db.json');
// Mutations inside this window share one disk write instead of one write each.
const SAVE_DEBOUNCE_MS = 50;

const SEED_GENRES: GenreRecord[] = [
  { id: 1, name: 'Action' },
  { id: 2, name: 'Adventure' },
  { id: 3, name: 'Drama' },
  { id: 4, name: 'Fantasy' },
  { id: 5, name: 'Mystery' },
  { id: 6, name: 'Sci-Fi' },
];

@Injectable()
export class DataService implements OnApplicationShutdown {
  private readonly logger = new Logger(DataService.name);
  private readonly storagePath: string;
  private writeTimer: NodeJS.Timeout | null = null;
  private writeChain: Promise<void> = Promise.resolve();
  private tempFileCounter = 0;

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

  constructor(private readonly config: ConfigService) {
    this.storagePath = this.config.get<string>('DATA_FILE') ?? DEFAULT_DATA_FILE;
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
    // Writes are coalesced and done asynchronously so a burst of requests does not
    // block the event loop rewriting the whole file once per mutation.
    if (this.writeTimer) {
      return;
    }

    this.writeTimer = setTimeout(() => {
      this.writeTimer = null;
      const payload = this.serialize();
      this.writeChain = this.writeChain
        .then(() => this.writeAtomic(payload))
        .catch((error: Error) => {
          this.logger.error(`Failed to persist datastore: ${error.message}`);
        });
    }, SAVE_DEBOUNCE_MS);
  }

  async flush() {
    // Wait for in-flight writes first so an older snapshot cannot land after this one.
    if (this.writeTimer) {
      clearTimeout(this.writeTimer);
      this.writeTimer = null;
    }

    await this.writeChain;
    this.writeSync(this.serialize());
  }

  async onApplicationShutdown() {
    await this.flush();
  }

  private serialize() {
    this.pruneExpiredTokens(new Date());
    return JSON.stringify(this.snapshot(), null, 2);
  }

  private pruneExpiredTokens(now: Date) {
    // Expired sessions and spent reset tokens can never be accepted again, so keeping
    // them only grows the file. Revoked-but-unexpired refresh tokens stay because
    // reuse detection depends on recognising them.
    removeWhere(this.refreshTokens, (token) => token.expiresAt <= now);
    removeWhere(this.passwordResetTokens, (token) => token.expiresAt <= now || token.usedAt !== null);
  }

  private async writeAtomic(payload: string) {
    // Each write uses its own temp file and an atomic rename, so a partial write
    // never corrupts the datastore and overlapping writes never share a temp file.
    mkdirSync(dirname(this.storagePath), { recursive: true });
    const tempFile = this.nextTempFile();
    await writeFile(tempFile, payload, 'utf8');
    await rename(tempFile, this.storagePath);
  }

  private writeSync(payload: string) {
    mkdirSync(dirname(this.storagePath), { recursive: true });
    const tempFile = this.nextTempFile();
    writeFileSync(tempFile, payload, 'utf8');
    renameSync(tempFile, this.storagePath);
  }

  private nextTempFile() {
    this.tempFileCounter += 1;
    return `${this.storagePath}.${process.pid}.${this.tempFileCounter}.tmp`;
  }

  private loadOrSeed() {
    if (this.loadFromDisk()) {
      return;
    }

    this.seed();
    // The first write is synchronous so the file exists as soon as boot finishes,
    // which the AniList import script relies on.
    this.writeSync(this.serialize());
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
        replacedByTokenId: token.replacedByTokenId ?? null,
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

    const now = new Date();
    const genres = SEED_GENRES.map((genre) => ({ ...genre }));
    this.genres.push(...genres);

    if (this.config.get<string>('NODE_ENV') === 'production') {
      // Production never gets the demo accounts and their published password. An
      // admin is only created when its credentials come from the environment.
      this.seedProductionAdmin(now);
      return;
    }

    // Seed just enough realistic data to make every page feel populated on first boot.
    const adminId = 'seed-user-admin';
    const demoId = 'seed-user-demo';
    const guestId = 'seed-user-otaku';
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

    const animeOne = 'ff0c8c69-b21f-4dfa-a22b-1bfba63c20e3';
    const animeTwo = '00955f2a-9ded-443c-ae93-6eb7e6e987ec';
    const animeThree = 'ce094da3-7f20-4b11-aa7e-d9540691520d';
    const animeFour = '665c3d83-1862-4d22-bd19-a3a69c3720f5';
    const animeFive = 'aeae9dd3-554e-47bf-9bb7-297566662dd1';
    const animeSix = 'a9a18938-2963-46ba-ae87-6bfabdd1ecb8';

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

  private seedProductionAdmin(now: Date) {
    const email = this.config.get<string>('SEED_ADMIN_EMAIL');
    const password = this.config.get<string>('SEED_ADMIN_PASSWORD');

    if (!email || !password) {
      this.logger.warn(
        'Production datastore created without an admin. Set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD to create one on first boot.',
      );
      return;
    }

    this.users.push({
      id: randomUUID(),
      username: 'admin',
      email: email.toLowerCase(),
      passwordHash: bcrypt.hashSync(password, 12),
      role: 'admin',
      isBanned: false,
      banReason: null,
      bannedUntil: null,
      failedLoginAttempts: 0,
      lockedUntil: null,
      lastLoginAt: null,
      createdAt: now,
      updatedAt: now,
    });
  }
}
