// Expired sessions and spent reset tokens can never be accepted again, so they are
// deleted hourly. Revoked-but-unexpired refresh tokens stay: reuse detection depends
// on recognising them. Deleting is idempotent, so several instances can all run it.
import { Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { PrismaService } from './prisma.service';

const CLEANUP_INTERVAL_MS = 60 * 60 * 1000;

@Injectable()
export class TokenCleanupService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(TokenCleanupService.name);
  private timer: NodeJS.Timeout | null = null;

  constructor(private readonly prisma: PrismaService) {}

  onApplicationBootstrap() {
    this.timer = setInterval(() => void this.prune(), CLEANUP_INTERVAL_MS);
    this.timer.unref();
  }

  onApplicationShutdown() {
    if (this.timer) clearInterval(this.timer);
  }

  async prune(now = new Date()) {
    try {
      await this.prisma.refreshToken.deleteMany({ where: { expiresAt: { lte: now } } });
      await this.prisma.passwordResetToken.deleteMany({ where: { OR: [{ expiresAt: { lte: now } }, { usedAt: { not: null } }] } });
    } catch (error) {
      this.logger.warn(`Token cleanup failed: ${(error as Error).message}`);
    }
  }
}
