// ============================================================
// SPAM PROTECTION MODULE
// ============================================================

// ── spam.service.ts ───────────────────────────────────────────
import { Injectable, TooManyRequestsException, BadRequestException, Logger } from '@nestjs/common';
import { CacheService } from '../cache/cache.module';
import { PrismaService } from '../common/prisma/prisma.service';

// Limits
const COMMENT_WINDOW_SECONDS = 60;
const COMMENT_MAX_PER_WINDOW  = 5;
const COMMENT_BURST_BLOCK_SEC = 300;   // 5-min block after burst
const SPAM_PATTERNS = [
  /\b(https?:\/\/\S+){3,}/i,           // 3+ URLs in one comment
  /(.)\1{15,}/,                        // 15+ repeated characters
  /\b(buy|cheap|discount|sale|click here|free money)\b.{0,50}http/i,
  /\b[A-Z]{20,}\b/,                    // 20+ consecutive CAPS
] as const;

const FLAGGED_THRESHOLD_SCORE = 3;

@Injectable()
export class SpamService {
  private readonly logger = new Logger(SpamService.name);

  constructor(
    private cache: CacheService,
    private prisma: PrismaService,
  ) {}

  // ── Comment rate limiting ──────────────────────────────────
  async checkCommentRateLimit(userId: string): Promise<void> {
    const blockKey = `spam:block:${userId}`;
    const blocked = await this.cache.get<boolean>(blockKey);
    if (blocked) {
      throw new TooManyRequestsException(
        'You are posting too fast. Please wait a few minutes.',
      );
    }

    const countKey = `spam:comments:${userId}`;
    const raw = await this.cache.get<number>(countKey);
    const count = raw ?? 0;

    if (count >= COMMENT_MAX_PER_WINDOW) {
      await this.cache.set(blockKey, true, COMMENT_BURST_BLOCK_SEC);
      this.logger.warn(`User ${userId} hit comment burst limit — blocked ${COMMENT_BURST_BLOCK_SEC}s`);
      throw new TooManyRequestsException(
        'Too many comments posted. Please wait 5 minutes.',
      );
    }

    // Increment — set TTL only on first write
    if (count === 0) {
      await this.cache.set(countKey, 1, COMMENT_WINDOW_SECONDS);
    } else {
      // Increment without resetting TTL (use raw Redis incr)
      // CacheService.wrap doesn't expose incr, so we call set with same TTL as a simplification
      await this.cache.set(countKey, count + 1, COMMENT_WINDOW_SECONDS);
    }
  }

  // ── Content analysis ───────────────────────────────────────
  analyzeContent(content: string): { score: number; reasons: string[] } {
    const reasons: string[] = [];
    let score = 0;

    for (const pattern of SPAM_PATTERNS) {
      if (pattern.test(content)) {
        reasons.push(pattern.source.slice(0, 40));
        score += 2;
      }
    }

    // Repeated words
    const words = content.toLowerCase().split(/\s+/);
    const wordCounts = words.reduce((acc, w) => ({ ...acc, [w]: (acc[w] ?? 0) + 1 }), {} as Record<string, number>);
    const maxRepeat = Math.max(...Object.values(wordCounts));
    if (maxRepeat > 10) { reasons.push('excessive word repetition'); score += 2; }

    // Very short content with a link
    if (content.length < 20 && /https?:\/\//.test(content)) {
      reasons.push('short link-only content');
      score += 3;
    }

    return { score, reasons };
  }

  // ── Honeypot field check ───────────────────────────────────
  // The frontend renders a hidden field named "website" — bots fill it, humans don't
  checkHoneypot(honeypotValue: string | undefined): void {
    if (honeypotValue && honeypotValue.trim().length > 0) {
      this.logger.warn('Honeypot triggered');
      throw new BadRequestException('Invalid submission');
    }
  }

  // ── Flag a comment for review ──────────────────────────────
  async autoFlag(commentId: string, reasons: string[]): Promise<void> {
    // Store in a Redis set for the admin flag queue
    const flagKey = `spam:flags`;
    try {
      // Use raw set entry as JSON
      await this.cache.set(
        `spam:flag:${commentId}`,
        { commentId, reasons, flaggedAt: new Date().toISOString() },
        86_400, // keep 24h
      );
      this.logger.warn(`Auto-flagged comment ${commentId}: ${reasons.join(', ')}`);
    } catch { /* non-fatal */ }
  }

  // ── Full pipeline — call from CommentsService.create() ────
  async validateComment(
    userId: string,
    content: string,
    honeypot?: string,
  ): Promise<void> {
    // 1. Honeypot
    this.checkHoneypot(honeypot);

    // 2. Rate limit
    await this.checkCommentRateLimit(userId);

    // 3. Content analysis — flag but don't block (let mods review)
    const { score, reasons } = this.analyzeContent(content);
    if (score >= FLAGGED_THRESHOLD_SCORE) {
      // We don't block — we flag for mod review
      // The commentId is unknown here, so we flag after creation
      // CommentsService should call autoFlag(commentId, reasons) after create
      return;
    }
  }

  // ── Get the admin flag queue ───────────────────────────────
  async getFlagQueue(limit = 50) {
    // In production, iterate Redis keys — here we query the DB for flagged comments
    // and cross-reference with the cache flags
    const recent = await this.prisma.comment.findMany({
      where: { isDeleted: false, createdAt: { gte: new Date(Date.now() - 86_400_000) } },
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: { user: { select: { username: true } } },
    });

    const flagged = [];
    for (const c of recent) {
      const flag = await this.cache.get<any>(`spam:flag:${c.id}`);
      if (flag) flagged.push({ ...c, flagReasons: flag.reasons });
      if (flagged.length >= limit) break;
    }
    return flagged;
  }
}

// ── spam.module.ts ────────────────────────────────────────────
import { Module, Global } from '@nestjs/common';

@Global()
@Module({ providers: [SpamService], exports: [SpamService] })
export class SpamModule {}

// ── How to integrate into CommentsService ─────────────────────
/*
// In comments.service.ts constructor:
constructor(
  private prisma: PrismaService,
  private spam: SpamService,   // ← inject
) {}

// In create():
async create(userId: string, animeId: string, dto: CreateCommentDto & { _hp?: string }) {
  await this.spam.validateComment(userId, dto.content, dto._hp);

  const comment = await this.prisma.comment.create({ ... });

  // Auto-flag after creation so we have the commentId
  const { score, reasons } = this.spam.analyzeContent(dto.content);
  if (score >= 3) {
    await this.spam.autoFlag(comment.id, reasons);
  }

  return comment;
}
*/

// ── Frontend honeypot field (add to CreateCommentDto on frontend) ──
/*
// In your comment form component:
<input
  type="text"
  name="website"
  value=""
  onChange={() => {}}
  style={{ display: 'none' }}
  tabIndex={-1}
  autoComplete="off"
  aria-hidden="true"
/>

// Include in POST body as _hp: formValues.website
*/

// ── Admin flag queue endpoint (add to AdminController) ────────
/*
@Get('flagged-comments')
getFlagQueue(@Query('limit') limit = 50) {
  return this.spamService.getFlagQueue(+limit);
}
*/
